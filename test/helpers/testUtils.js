import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { readDocuments } from "../../src/ingest.js";
import { SQLiteVectorStore } from "../../src/sqliteStore.js";
import { tokenize } from "../../src/text.js";

export function hashEmbedding(text, dimensions = 4096) {
  const vector = new Array(dimensions).fill(0);
  const tokens = tokenize(text, { removeStopWords: false });
  for (const token of tokens) {
    let hash = 2166136261;
    for (let i = 0; i < token.length; i += 1) {
      hash ^= token.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    const index = Math.abs(hash) % dimensions;
    vector[index] += 1;
  }
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
  return vector.map((value) => value / norm);
}

export function createTempDir(prefix = "agu-rag-") {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

export function buildTestStore(docsDir) {
  const tempDir = createTempDir();
  const dbPath = path.join(tempDir, "test.db");
  const store = new SQLiteVectorStore(dbPath);
  const documents = readDocuments(docsDir);
  const items = documents.map((item) => ({
    document: item.document,
    passages: item.passages.map((passage) => ({
      ...passage,
      embedding: hashEmbedding(`${item.document.title} ${passage.section} ${passage.plainText}`),
    })),
  }));
  store.replaceAll(items, {
    schema_version: "test",
    embedding_model: "hash-test",
    embedding_dimensions: "4096",
  });
  return { store, tempDir, dbPath };
}

export function removeTempDir(tempDir) {
  fs.rmSync(tempDir, { recursive: true, force: true });
}
