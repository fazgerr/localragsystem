import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { buildKnowledgeBase } from "../src/ingest.js";
import { SQLiteVectorStore } from "../src/sqliteStore.js";
import { config } from "../src/config.js";
import { createTempDir, hashEmbedding, removeTempDir } from "./helpers/testUtils.js";

test("Belge alma hattı gerçek embedding biçimini SQLite'a yazar", async () => {
  const tempDir = createTempDir("agu-ingest-");
  const dbPath = path.join(tempDir, "knowledge.db");
  const store = new SQLiteVectorStore(dbPath);
  const cfg = { ...config, dbPath };
  try {
    const result = await buildKnowledgeBase({
      cfg,
      store,
      embedder: async (texts) => texts.map((text) => hashEmbedding(text, 128)),
    });
    assert.equal(result.documents, 17);
    assert.equal(result.passages, 30);
    assert.equal(result.dimensions, 128);
    assert.equal(store.hasEmbeddings(), true);
    assert.equal(store.getMetadata("embedding_model"), config.embeddingModel);
  } finally {
    store.close();
    removeTempDir(tempDir);
  }
});
