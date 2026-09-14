import {
  characterTrigrams,
  extractNumberTokens,
  jaccard,
  normalizeText,
  splitSentences,
  stripMarkdown,
  tokenize,
  wordCount,
} from "./text.js";

const DOMAIN_TERMS = new Set([
  "staj", "ie197", "ie297", "ie397", "sigorta", "sgk", "rapor", "sunum",
  "form", "belge", "evrak", "isyeri", "firma", "komisyon", "danisman",
  "teslim", "degerlendirme", "puan", "akts", "devamsiz", "izin", "tatil",
  "kvkk", "basvuru", "gonullu", "mezuniyet", "sinif", "gun", "hafta",
]);

const FOLLOW_UP_MARKERS = new Set([
  "peki", "ya", "onda", "bunda", "bunun", "onun", "o", "bu", "kaç",
  "nereye", "kim", "ne zaman", "sonra", "peki ya",
]);

export function isDomainQuestion(question) {
  const normalized = normalizeText(question);
  const tokens = tokenize(question, { removeStopWords: false });
  if (tokens.some((token) => DOMAIN_TERMS.has(token))) return true;
  // Staj uygulamasında sınıf geçişi tek başına yazılabilir: “1'den 2'ye geçerken kaç?”
  // Bu, belirli bir cümleyi ezberlemek yerine tüm 1→2, 2→3 ve 3→4 geçişlerini kapsar.
  return /\b(?:1\s+2|2\s+3|3\s+4)\s+gec\b/.test(normalized);
}

export function isLikelyFollowUp(question) {
  const normalized = normalizeText(question);
  const tokens = tokenize(question, { removeStopWords: false });
  if (!normalized || tokens.length > 10) return false;
  const normalizedMarkers = new Set(["peki", "ya", "onda", "bunda", "bunun", "onun", "sayi", "nereye", "kim", "sonra"]);
  if (tokens.some((token) => normalizedMarkers.has(token))) return true;
  return [...FOLLOW_UP_MARKERS].some(
    (marker) => normalized === marker || normalized.startsWith(`${marker} `) || normalized.includes(` ${marker} `)
  );
}

export function resolveQuestion(question, history = [], maxUserTurns = 2) {
  const current = String(question || "").trim();
  if (!isLikelyFollowUp(current)) return current;
  const previous = history
    .filter((item) => item?.role === "user" && typeof item.content === "string")
    .slice(-maxUserTurns)
    .map((item) => item.content.trim())
    .filter(Boolean);
  return previous.length ? `${previous.at(-1)} | Takip sorusu: ${current}` : current;
}

function normalizeAnswer(value = "") {
  return String(value)
    .replace(/&#x20;|&#32;|&nbsp;/gi, " ")
    .replace(/<\|[^>]+\|>/g, "")
    .replace(/^```(?:text|markdown)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .replace(/^cevap\s*:\s*/i, "")
    .replace(/\b(?:passage|document)\s*\d+\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function trimToWords(value, maxWords) {
  const answer = normalizeAnswer(value);
  if (wordCount(answer) <= maxWords) return answer;
  const sentences = splitSentences(answer);
  const selected = [];
  let total = 0;
  for (const sentence of sentences) {
    const count = wordCount(sentence);
    if (!selected.length && count > maxWords) {
      return sentence.split(/\s+/).slice(0, maxWords).join(" ").trim();
    }
    if (selected.length && total + count > maxWords) break;
    selected.push(sentence);
    total += count;
  }
  return selected.join(" ").trim() || answer.split(/\s+/).slice(0, maxWords).join(" ").trim();
}

function evidenceText(passages) {
  return passages.map((item) => item.plainText || item.content || "").join(" ");
}

function unsupportedNumbers(answer, passages) {
  const allowed = extractNumberTokens(evidenceText(passages));
  const used = extractNumberTokens(answer);
  return [...used].filter((number) => !allowed.has(number));
}

function relatedness(answer, passages) {
  const answerTokens = new Set(tokenize(answer));
  const source = evidenceText(passages);
  const sourceTokens = new Set(tokenize(source));
  if (!answerTokens.size) return 0;
  let overlap = 0;
  for (const token of answerTokens) if (sourceTokens.has(token)) overlap += 1;
  const coverage = overlap / answerTokens.size;
  const fuzzy = jaccard(characterTrigrams(answer), characterTrigrams(source));
  return Math.max(coverage, fuzzy);
}


function namedEntities(value = "") {
  const normalized = normalizeText(value);
  return new Set(
    normalized.match(/\bie(?:197|297|397)\b|\b(?:kvkk|sgk|akts)\b/g) || []
  );
}

function claimSupportErrors(answer, passages) {
  const sourcePassages = passages.map((passage) => {
    const body = passage.plainText || passage.content || "";
    // Belge başlığı birden fazla ders kodu içerebilir. Bu nedenle iddia
    // doğrulamasında yalnızca pasajın özgül bölüm başlığı ve gövdesi kullanılır.
    const heading = passage.section || "";
    const full = `${heading} ${body}`;
    const bodySentences = splitSentences(body).map((sentence) => `${heading} ${sentence}`);
    const sectionHasEntity = namedEntities(heading).size > 0;
    return {
      text: full,
      sentences: sectionHasEntity ? [full, ...bodySentences] : bodySentences,
    };
  });
  const errors = [];

  for (const sentence of splitSentences(answer)) {
    const numbers = extractNumberTokens(sentence);
    const entities = namedEntities(sentence);
    if (!numbers.size && !entities.size) continue;

    const entityAndNumberClaim = numbers.size > 0 && entities.size > 0;
    const supported = sourcePassages.some((passage) => {
      const scopes = entityAndNumberClaim ? passage.sentences : [passage.text];
      return scopes.some((scope) => {
        const scopeNumbers = extractNumberTokens(scope);
        const scopeEntities = namedEntities(scope);
        const hasNumbers = [...numbers].every((number) => scopeNumbers.has(number));
        const hasEntities = [...entities].every((entity) => scopeEntities.has(entity));
        if (!hasNumbers || !hasEntities) return false;
        const claimTokens = new Set(tokenize(sentence));
        const sourceTokens = new Set(tokenize(scope));
        let overlap = 0;
        for (const token of claimTokens) if (sourceTokens.has(token)) overlap += 1;
        return overlap / Math.max(1, claimTokens.size) >= 0.35;
      });
    });
    if (!supported) errors.push(sentence);
  }
  return errors;
}


function textualClaimSupportErrors(answer, passages) {
  const scopes = [];
  for (const passage of passages) {
    const heading = passage.section || "";
    const body = passage.plainText || passage.content || "";
    scopes.push(`${heading} ${body}`);
    scopes.push(...splitSentences(body).map((sentence) => `${heading} ${sentence}`));
  }

  const errors = [];
  for (const sentence of splitSentences(answer)) {
    const claimTokens = new Set(tokenize(sentence));
    if (!claimTokens.size) continue;
    let bestCoverage = 0;
    let bestFuzzy = 0;
    for (const scope of scopes) {
      const sourceTokens = new Set(tokenize(scope));
      let overlap = 0;
      for (const token of claimTokens) if (sourceTokens.has(token)) overlap += 1;
      bestCoverage = Math.max(bestCoverage, overlap / claimTokens.size);
      bestFuzzy = Math.max(bestFuzzy, jaccard(characterTrigrams(sentence), characterTrigrams(scope)));
    }
    // Modelin yeni bir özne, kurum veya kural eklemesine izin verilmez.
    // Doğal yeniden ifade mümkündür; düşük destekli cümle doğrudan kaynak özetine düşer.
    if (bestCoverage < 0.78 && bestFuzzy < 0.48) errors.push(sentence);
  }
  return errors;
}

export function validateAnswer(answer, passages, { maxWords = 110 } = {}) {
  const cleaned = trimToWords(answer, maxWords);
  const errors = [];
  if (!cleaned || cleaned.length < 3) errors.push("empty");
  if (/\bBILGI_YOK\b/i.test(cleaned)) errors.push("no-source");
  if (/\b(?:uydur|tahmin|belki|muhtemelen)\b/i.test(cleaned)) errors.push("speculation");
  if (/\b(?:kullanici talimat|kullanıcı talimat|kanitlar|kanıtlar|sistem talimati|sistem talimatı)\b/i.test(cleaned)) {
    errors.push("prompt-framing-leak");
  }
  const unsupported = unsupportedNumbers(cleaned, passages);
  if (unsupported.length) errors.push(`unsupported-numbers:${unsupported.join(",")}`);
  const unsupportedClaims = claimSupportErrors(cleaned, passages);
  if (unsupportedClaims.length) errors.push("unsupported-claim-cooccurrence");
  const unsupportedTextClaims = textualClaimSupportErrors(cleaned, passages);
  if (unsupportedTextClaims.length) errors.push("unsupported-text-claim");
  if (relatedness(cleaned, passages) < 0.18) errors.push("low-relatedness");
  return { valid: errors.length === 0, answer: cleaned, errors };
}

export function extractiveFallback(question, passages, maxSentences = 4) {
  const queryTokens = new Set(tokenize(question));
  const normalizedQuestion = normalizeText(question);
  const requestedCourseCodes = [...new Set(
    normalizedQuestion.match(/\bie(?:197|297|397)\b/g) || []
  )];
  const asksForCount = queryTokens.has("sayi");
  const asksForSpecificCourse = /\bie(?:197|297|397)\b/.test(normalizedQuestion);
  const candidates = [];

  for (const passage of passages) {
    const text = stripMarkdown(passage.plainText || passage.content || "");
    for (const sentence of splitSentences(text)) {
      const scoringText = `${passage.section || ""} ${passage.title || ""} ${sentence}`;
      const sentenceTokens = new Set(tokenize(scoringText));
      let overlap = 0;
      for (const token of queryTokens) if (sentenceTokens.has(token)) overlap += 1;
      const coverage = overlap / Math.max(1, queryTokens.size);
      const fuzzy = jaccard(characterTrigrams(question), characterTrigrams(scoringText));
      // “Kaç ayrı ...?” türü genel sayım sorularında, kanıttaki yazıyla
      // ifade edilen sayıyı öne çıkar. Belirli bir IE dersi soruluyorsa bu
      // artış uygulanmaz; ders-süre eşleşmesinin önüne geçemez.
      const countIntentBoost =
        asksForCount &&
        !asksForSpecificCourse &&
        /\b(?:bir|iki|uc|dort|bes|alti|yedi|sekiz|dokuz|on)\b/.test(normalizeText(sentence))
          ? 0.30
          : 0;
      candidates.push({
        sentence,
        section: passage.section || "",
        passageId: passage.passageId,
        courseCodes: [...namedEntities(`${passage.section || ""} ${sentence}`)]
          .filter((item) => /^ie/.test(item)),
        score: Math.min(1, coverage * 0.8 + fuzzy * 0.2 + countIntentBoost),
      });
    }
  }

  candidates.sort((a, b) => b.score - a.score);

  // Birden fazla IE dersi aynı soruda isteniyorsa her ders için kanıtı ayrı
  // seç ve bölüm başlığını cevaba taşı. Böylece “20 gün, 30 gün” gibi hangi
  // sürenin hangi derse ait olduğu belirsiz cevaplar oluşmaz.
  if (requestedCourseCodes.length > 1) {
    const courseItems = requestedCourseCodes.map((code) => {
      const durationCandidates = candidates.filter((item) =>
        item.courseCodes.includes(code) &&
        tokenize(item.sentence).some((token) => ["gun", "hafta", "akts", "sure"].includes(token))
      );
      return durationCandidates[0] || candidates.find((item) => item.courseCodes.includes(code));
    });
    if (courseItems.every(Boolean)) {
      return {
        answer: courseItems.map((item) =>
          normalizeText(item.sentence).includes(item.courseCodes[0])
            ? item.sentence
            : `${item.section}: ${item.sentence}`
        ).join(" ").trim(),
        evidenceIds: [...new Set(courseItems.map((item) => item.passageId))],
        bestScore: Math.min(...courseItems.map((item) => item.score)),
      };
    }
  }

  const selectionFloor = asksForCount && !asksForSpecificCourse
    ? Math.max(0.18, (candidates[0]?.score || 0) - 0.12)
    : 0;
  const selected = [];
  const seen = new Set();
  for (const item of candidates) {
    if (item.score < selectionFloor) continue;
    const key = normalizeText(item.sentence);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    selected.push(item);
    if (selected.length >= maxSentences) break;
  }

  return {
    answer: selected.map((item) => item.sentence).join(" ").trim(),
    evidenceIds: [...new Set(selected.map((item) => item.passageId))],
    bestScore: selected[0]?.score || 0,
  };
}
