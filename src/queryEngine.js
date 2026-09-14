import { config } from "./config.js";
import { SQLiteVectorStore } from "./sqliteStore.js";
import { FoundryRuntime } from "./foundryRuntime.js";
import {
  extractiveFallback,
  isDomainQuestion,
  resolveQuestion,
  validateAnswer,
} from "./answerGuard.js";
import { ANSWER_SYSTEM_PROMPT, buildAnswerPrompt } from "./prompts.js";
import { extractNumberTokens, normalizeText, tokenize } from "./text.js";

function limitContext(passages, maxPassages, maxChars) {
  const selected = [];
  let used = 0;
  for (const passage of passages.slice(0, maxPassages)) {
    const text = String(passage.plainText || passage.content || "");
    const remaining = maxChars - used;
    if (remaining < 120) break;
    const clipped = text.length > remaining ? `${text.slice(0, remaining - 1).trim()}…` : text;
    selected.push({ ...passage, plainText: clipped });
    used += clipped.length;
  }
  return selected;
}

function sourceMetadata(passages) {
  const byDocument = new Map();
  for (const passage of passages) {
    if (!byDocument.has(passage.docId)) {
      byDocument.set(passage.docId, {
        docId: passage.docId,
        title: passage.title,
        category: passage.category,
        sourceFile: passage.sourceFile,
        score: passage.score,
        passages: [],
      });
    }
    byDocument.get(passage.docId).passages.push({
      passageId: passage.passageId,
      section: passage.section,
      excerpt: String(passage.plainText || passage.content || "").slice(0, 320),
      score: passage.score,
      semanticScore: passage.semanticScore,
      lexicalScore: passage.lexicalScore,
    });
  }
  return [...byDocument.values()];
}

export class QueryEngine {
  constructor({ cfg = config, store = null, runtime = null } = {}) {
    this.cfg = cfg;
    this.store = store || new SQLiteVectorStore(cfg.dbPath);
    this.runtime = runtime || new FoundryRuntime({ cfg });
    this.statusCallback = null;
    this.runtime.onStatus((status) => this.statusCallback?.(status));
  }

  onStatus(callback) {
    this.statusCallback = callback;
    this.runtime.onStatus(callback);
  }

  async init() {
    if (!this.store.countPassages()) {
      throw new Error("Bilgi tabanı boş. Önce 'npm run ingest' çalıştırılmalı.");
    }
    if (!this.store.hasEmbeddings()) {
      throw new Error("SQLite bilgi tabanında embedding vektörleri yok. 'npm run ingest' komutunu yeniden çalıştırın.");
    }
    await this.runtime.initialize({ needEmbedding: true, needChat: true });
    this.statusCallback?.({
      phase: "ready",
      message: `Hazır: ${this.store.countDocuments()} belge, ${this.store.countPassages()} pasaj`,
    });
  }

  getStore() {
    return this.store;
  }

  async query(question, history = []) {
    const rawQuestion = String(question || "").trim();
    if (!rawQuestion) {
      return { text: this.cfg.noSourceMessage, sources: [], grounded: false, reason: "empty" };
    }

    const standaloneQuestion = resolveQuestion(
      rawQuestion,
      history,
      this.cfg.maxHistoryUserTurns
    );
    const normalizedQuestion = normalizeText(standaloneQuestion);
    const questionTokens = new Set(tokenize(standaloneQuestion));
    const requestedCourseCodes = new Set(
      normalizedQuestion.match(/\bie(?:197|297|397)\b/g) || []
    );
    const multiCourseQuestion = requestedCourseCodes.size > 1;
    const programStageCountIntent =
      questionTokens.has("sayi") &&
      questionTokens.has("staj") &&
      ["mezuniyet", "tamamla", "ayri", "zorunlu"].some((token) => questionTokens.has(token));
    const retrievalQuestion = programStageCountIntent
      ? `${standaloneQuestion} staj programı aşama aşamalar zorunlu tamamlamak yükümlü`
      : standaloneQuestion;

    // Açıkça alan dışındaki sorular için model ve embedding çalıştırılmaz. Böylece
    // hava durumu, aile veya genel sohbet soruları yanlış bir belgeyle eşleşemez.
    if (!isDomainQuestion(standaloneQuestion)) {
      return {
        text: this.cfg.outOfScopeMessage,
        sources: [],
        grounded: false,
        reason: "out-of-scope",
      };
    }

    let queryEmbedding = null;
    let embeddingError = null;
    if (!programStageCountIntent && !multiCourseQuestion) {
      try {
        queryEmbedding = await this.runtime.embedOne(retrievalQuestion);
      } catch (error) {
        embeddingError = error;
        console.warn(`[RAG] Sorgu embeddingi üretilemedi; sözcüksel aramaya geçiliyor: ${error.message}`);
      }
    }

    const results = this.store.search({
      queryText: retrievalQuestion,
      queryEmbedding,
      topK: this.cfg.searchTopK,
      semanticWeight: this.cfg.semanticWeight,
      lexicalWeight: this.cfg.lexicalWeight,
    });

    const top = results[0];
    const relevant = results.filter(
      (item) =>
        item.score >= this.cfg.minimumHybridScore ||
        item.lexicalScore >= this.cfg.minimumLexicalScore
    );

    if (!top || !relevant.length) {
      const inDomain = isDomainQuestion(standaloneQuestion);
      return {
        text: inDomain ? this.cfg.noSourceMessage : this.cfg.outOfScopeMessage,
        sources: [],
        grounded: false,
        reason: inDomain ? "no-source" : "out-of-scope",
        retrieval: { mode: queryEmbedding ? "hybrid" : "lexical", embeddingError: embeddingError?.message || null },
      };
    }

    const context = limitContext(
      relevant,
      this.cfg.maxContextPassages,
      this.cfg.maxContextChars
    );

    // Ücret/maaş gibi para sorularında modelin alakasız puan veya yüzde
    // pasajlarından bir cevap türetmesini engelle. Sorudaki para terimi
    // kanıtta açıkça yoksa model hiç çağrılmaz.
    const requestedMoneyTerms = normalizedQuestion.match(/\b(?:maas(?:i|in)?|ucret(?:i|in)?|tl)\b/g) || [];
    if (requestedMoneyTerms.length) {
      const evidenceText = normalizeText(context
        .map((item) => item.plainText || item.content || "")
        .join(" "));
      if (requestedMoneyTerms.some((term) => !new RegExp(`\\b${term}\\b`).test(evidenceText))) {
        return {
          text: this.cfg.noSourceMessage,
          sources: sourceMetadata(context),
          grounded: false,
          reason: "no-source",
          verification: "requested-money-term-not-in-evidence",
        };
      }
    }

    // Kullanıcının açıkça sorduğu bir takvim yılı kanıtlarda yoksa modelin
    // yakın bir tarihi “cevap” olarak seçmesine izin verilmez.
    const requestedYears = [...extractNumberTokens(standaloneQuestion)].filter(
      (value) => Number(value) >= 1900 && Number(value) <= 2099
    );
    if (requestedYears.length) {
      const evidenceNumbers = extractNumberTokens(
        context.map((item) => item.plainText || item.content || "").join(" ")
      );
      if (requestedYears.some((year) => !evidenceNumbers.has(year))) {
        return {
          text: this.cfg.noSourceMessage,
          sources: sourceMetadata(context),
          grounded: false,
          reason: "no-source",
          verification: "requested-year-not-in-evidence",
        };
      }
    }

    // “Kaç ayrı staj?” gibi genel sayım sorularında doğru kaynak cümlesi
    // yeterince güçlüyse küçük chat modelini beklemeden doğrudan kanıtı döndür.
    // Bu bir cevap tablosu değildir; sonuç her zaman seçilen pasajdan çıkarılır.
    const fastFallback = extractiveFallback(standaloneQuestion, context, 4);
    const generalCountIntent = /\b(?:sayi|kac|adet)\b/.test(normalizedQuestion) &&
      !/\bie(?:197|297|397)\b/.test(normalizedQuestion);
    if (generalCountIntent || multiCourseQuestion) {
      if (fastFallback.answer && fastFallback.bestScore >= this.cfg.minimumExtractiveScore) {
        const fallbackPassages = context.filter((item) =>
          fastFallback.evidenceIds.includes(item.passageId)
        );
        return {
          text: fastFallback.answer,
          sources: sourceMetadata(fallbackPassages.length ? fallbackPassages : context),
          grounded: true,
          reason: "extractive-fast-path",
          verification: "direct-source-extraction",
          retrieval: {
            mode: queryEmbedding ? "foundry-embedding+lexical" : "lexical-fallback",
            topScore: top.score,
          },
        };
      }
    }

    let modelAnswer = "";
    let modelError = null;
    let modelDeclaredNoSource = false;
    try {
      modelAnswer = await this.runtime.complete({
        system: ANSWER_SYSTEM_PROMPT,
        user: buildAnswerPrompt(standaloneQuestion, context),
        maxTokens: this.cfg.answerMaxTokens,
      });
    } catch (error) {
      modelError = error;
      console.warn(`[RAG] Yerel model yanıtı kullanılamadı: ${error.message}`);
    }

    if (modelAnswer) {
      const checked = validateAnswer(modelAnswer, context, {
        maxWords: this.cfg.maxAnswerWords,
      });
      if (checked.valid) {
        return {
          text: checked.answer,
          sources: sourceMetadata(context),
          grounded: true,
          reason: "model-grounded",
          verification: "deterministic-evidence-guard",
          retrieval: {
            mode: queryEmbedding ? "foundry-embedding+lexical" : "lexical-fallback",
            topScore: top.score,
          },
        };
      }
      if (checked.errors.includes("no-source")) {
        // Küçük yerel model, açık kanıt mevcutken de BILGI_YOK diyebilir.
        // Bu sinyali tek başına otorite kabul etme; deterministik ve yeterince
        // güçlü bir doğrudan kaynak özeti varsa onu tercih et.
        modelDeclaredNoSource = true;
      } else {
        console.warn(`[RAG] Model cevabı kanıt denetiminden geçmedi: ${checked.errors.join(", ")}`);
      }
    }

    const strongRetrieval =
      top.lexicalScore >= this.cfg.minimumLexicalScore || top.score >= 0.34;
    if (strongRetrieval) {
      const fallback = extractiveFallback(standaloneQuestion, context, 4);
      if (fallback.answer && fallback.bestScore >= this.cfg.minimumExtractiveScore) {
        const fallbackPassages = context.filter((item) =>
          fallback.evidenceIds.includes(item.passageId)
        );
        return {
          text: fallback.answer,
          sources: sourceMetadata(fallbackPassages.length ? fallbackPassages : context),
          grounded: true,
          reason: "extractive-fallback",
          verification: "direct-source-extraction",
          warning: modelError?.message || null,
          retrieval: {
            mode: queryEmbedding ? "foundry-embedding+lexical" : "lexical-fallback",
            topScore: top.score,
          },
        };
      }
    }

    return {
      text: isDomainQuestion(standaloneQuestion)
        ? this.cfg.noSourceMessage
        : this.cfg.outOfScopeMessage,
      sources: [],
      grounded: false,
      reason: "insufficient-evidence",
      ...(modelDeclaredNoSource ? { reason: "model-no-source" } : {}),
      warning: modelError?.message || null,
    };
  }

  async addDocument(parsed) {
    const texts = parsed.passages.map(
      (passage) => `${parsed.document.title}\n${passage.section}\n${passage.plainText}`
    );
    const embeddings = await this.runtime.embedMany(texts, { batchSize: 8 });
    const passages = parsed.passages.map((passage, index) => ({
      ...passage,
      embedding: embeddings[index],
    }));
    this.store.upsertDocument(parsed.document, passages);
    return passages.length;
  }

  async close() {
    await this.runtime.close();
    this.store.close();
  }
}

export const __test = { limitContext, sourceMetadata };
