import test from "node:test";
import assert from "node:assert/strict";
import { FoundryRuntime, isMemoryError } from "../src/foundryRuntime.js";
import { config } from "../src/config.js";

class FakeModel {
  constructor(alias, type) {
    this.alias = alias;
    this.type = type;
    this.isCached = false;
    this.loaded = false;
    this.downloadCalls = 0;
    this.loadCalls = 0;
    this.unloadCalls = 0;
  }
  async download(callback) { this.downloadCalls += 1; callback?.(100); this.isCached = true; }
  async load() { this.loadCalls += 1; this.loaded = true; }
  async unload() { this.unloadCalls += 1; this.loaded = false; }
  createEmbeddingClient() {
    return {
      generateEmbedding: async () => ({ data: [{ embedding: [0.1, 0.2, 0.3] }] }),
      generateEmbeddings: async (texts) => ({ data: texts.map(() => ({ embedding: [0.1, 0.2, 0.3] })) }),
    };
  }
  createChatClient() {
    return {
      settings: {},
      completeChat: async () => ({ choices: [{ message: { content: "Kaynaklı cevap" } }] }),
    };
  }
}

function fakeManagerFactory() {
  const embedding = new FakeModel(config.embeddingModel, "embedding");
  const chat = new FakeModel(config.chatModel, "chat");
  const manager = {
    catalog: {
      getModel: async (alias) => alias === config.embeddingModel ? embedding : chat,
    },
  };
  return { manager, embedding, chat };
}

test("Foundry Local çalışma zamanı", async (t) => {
  await t.test("resmî embedding ve chat istemcilerini kullanır", async () => {
    const fake = fakeManagerFactory();
    const runtime = new FoundryRuntime({ cfg: config, managerFactory: async () => fake.manager });
    const vector = await runtime.embedOne("deneme");
    assert.deepEqual(vector, [0.1, 0.2, 0.3]);
    const answer = await runtime.complete({ system: "s", user: "u", maxTokens: 80 });
    assert.equal(answer, "Kaynaklı cevap");
    assert.equal(fake.embedding.downloadCalls, 1);
    assert.equal(fake.chat.downloadCalls, 1);
    await runtime.close();
  });

  await t.test("sıralı modda chat yüklenirken embedding modelini boşaltır", async () => {
    const fake = fakeManagerFactory();
    const runtime = new FoundryRuntime({ cfg: config, managerFactory: async () => fake.manager });
    await runtime.embedOne("deneme");
    await runtime.complete({ system: "s", user: "u" });
    assert.ok(fake.embedding.unloadCalls >= 1);
    assert.equal(fake.chat.loaded, true);
    await runtime.close();
  });

  await t.test("ONNX bellek hatalarını tanır", () => {
    assert.equal(isMemoryError(new Error("Could not allocate the key-value cache buffer")), true);
    assert.equal(isMemoryError(new Error("ordinary error")), false);
  });
});
