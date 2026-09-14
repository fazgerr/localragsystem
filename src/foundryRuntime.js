import { config } from "./config.js";

export function isMemoryError(error) {
  const message = String(error?.message || error || "").toLowerCase();
  return (
    message.includes("could not allocate") ||
    message.includes("failed to allocate memory") ||
    message.includes("key-value cache") ||
    message.includes("bfc_arena") ||
    (message.includes("onnxruntime") && message.includes("allocate"))
  );
}

function progressRatio(value) {
  const numeric = Number(value) || 0;
  return numeric > 1 ? Math.min(1, numeric / 100) : Math.min(1, numeric);
}

export class FoundryRuntime {
  constructor({ cfg = config, managerFactory = null } = {}) {
    this.cfg = cfg;
    this.managerFactory = managerFactory;
    this.manager = null;
    this.embeddingModel = null;
    this.chatModel = null;
    this.embeddingClient = null;
    this.chatClient = null;
    this.embeddingLoaded = false;
    this.chatLoaded = false;
    this.statusCallback = null;
    this.queue = Promise.resolve();
  }

  onStatus(callback) {
    this.statusCallback = callback;
  }

  emit(phase, message, progress) {
    const status = { phase, message, ...(progress === undefined ? {} : { progress }) };
    console.log(`[Foundry] ${message}`);
    this.statusCallback?.(status);
  }

  _enqueue(task) {
    const run = this.queue.then(task, task);
    this.queue = run.catch(() => {});
    return run;
  }

  async initialize({ needEmbedding = true, needChat = true } = {}) {
    if (!this.manager) {
      this.emit("runtime", "Microsoft Foundry Local başlatılıyor...");
      if (this.managerFactory) {
        this.manager = await this.managerFactory();
      } else {
        const { FoundryLocalManager } = await import("foundry-local-sdk");
        this.manager = FoundryLocalManager.create({
          appName: this.cfg.appName,
          appDataDir: this.cfg.foundryAppDataDir,
          logLevel: "warning",
        });
      }
    }

    if (needEmbedding && !this.embeddingModel) {
      this.embeddingModel = await this.manager.catalog.getModel(this.cfg.embeddingModel);
      await this._ensureDownloaded(this.embeddingModel, "Embedding modeli");
    }

    if (needChat && !this.chatModel) {
      this.chatModel = await this.manager.catalog.getModel(this.cfg.chatModel);
      await this._ensureDownloaded(this.chatModel, "Sohbet modeli");
    }
  }

  async _ensureDownloaded(model, label) {
    if (model.isCached) {
      this.emit("cached", `${label} önbellekte: ${model.alias}`);
      return;
    }
    let last = -1;
    this.emit("download", `${label} indiriliyor: ${model.alias}`, 0);
    await model.download((value) => {
      const ratio = progressRatio(value);
      const pct = Math.round(ratio * 100);
      if (pct !== last && (pct % 5 === 0 || pct === 100)) {
        last = pct;
        this.emit("download", `${label} indiriliyor: %${pct}`, ratio);
      }
    });
    this.emit("download", `${label} hazır: ${model.alias}`, 1);
  }

  async _unloadEmbedding() {
    if (!this.embeddingLoaded || !this.embeddingModel) return;
    try {
      await this.embeddingModel.unload();
    } finally {
      this.embeddingLoaded = false;
      this.embeddingClient = null;
    }
  }

  async _unloadChat() {
    if (!this.chatLoaded || !this.chatModel) return;
    try {
      await this.chatModel.unload();
    } finally {
      this.chatLoaded = false;
      this.chatClient = null;
    }
  }

  async _loadEmbedding() {
    await this.initialize({ needEmbedding: true, needChat: false });
    if (this.cfg.sequentialModels) await this._unloadChat();
    if (!this.embeddingLoaded) {
      this.emit("loading", `Embedding modeli yükleniyor: ${this.embeddingModel.alias}`);
      await this.embeddingModel.load();
      this.embeddingClient = this.embeddingModel.createEmbeddingClient();
      this.embeddingLoaded = true;
    }
  }

  async _loadChat() {
    await this.initialize({ needEmbedding: false, needChat: true });
    if (this.cfg.sequentialModels) await this._unloadEmbedding();
    if (!this.chatLoaded) {
      this.emit("loading", `Sohbet modeli yükleniyor: ${this.chatModel.alias}`);
      await this.chatModel.load();
      this.chatClient = this.chatModel.createChatClient();
      this.chatLoaded = true;
    }
  }

  async embedOne(text) {
    return this._enqueue(async () => {
      await this._loadEmbedding();
      const response = await this.embeddingClient.generateEmbedding(String(text));
      const vector = response?.data?.[0]?.embedding;
      if (!Array.isArray(vector) || !vector.length) {
        throw new Error("Embedding modeli geçerli vektör üretmedi.");
      }
      if (this.cfg.sequentialModels) await this._unloadEmbedding();
      return vector.map(Number);
    });
  }

  async embedMany(texts, { batchSize = 8 } = {}) {
    return this._enqueue(async () => {
      await this._loadEmbedding();
      const result = [];
      for (let start = 0; start < texts.length; start += batchSize) {
        const batch = texts.slice(start, start + batchSize).map(String);
        const response = await this.embeddingClient.generateEmbeddings(batch);
        const vectors = response?.data?.map((item) => item.embedding) || [];
        if (vectors.length !== batch.length || vectors.some((vector) => !Array.isArray(vector) || !vector.length)) {
          throw new Error("Embedding modeli bazı pasajlar için vektör üretemedi.");
        }
        result.push(...vectors.map((vector) => vector.map(Number)));
        this.emit(
          "embedding",
          `Pasajlar vektörleştiriliyor: ${Math.min(start + batch.length, texts.length)}/${texts.length}`,
          Math.min(1, (start + batch.length) / Math.max(1, texts.length))
        );
      }
      if (this.cfg.sequentialModels) await this._unloadEmbedding();
      return result;
    });
  }

  async complete({ system, user, maxTokens = this.cfg.answerMaxTokens }) {
    return this._enqueue(async () => {
      await this._loadChat();
      const settings = this.chatClient.settings;
      settings.temperature = 0;
      settings.topP = 0.2;
      settings.topK = 20;
      settings.randomSeed = 42;
      settings.maxTokens = maxTokens;
      settings.responseFormat = { type: "text" };

      try {
        const response = await this.chatClient.completeChat([
          { role: "system", content: system },
          { role: "user", content: user },
        ]);
        const answer = response?.choices?.[0]?.message?.content;
        if (typeof answer !== "string" || !answer.trim()) {
          throw new Error("Yerel model boş cevap üretti.");
        }
        return answer.trim();
      } catch (error) {
        if (isMemoryError(error)) {
          throw new Error(
            "Yerel model yeterli bellek ayıramadı. Uygulama güvenli belge özetiyle devam edecek.",
            { cause: error }
          );
        }
        throw error;
      }
    });
  }

  async close() {
    await this._enqueue(async () => {
      await this._unloadEmbedding();
      await this._unloadChat();
    });
  }
}
