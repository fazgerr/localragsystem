import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { buildTestStore, hashEmbedding, removeTempDir } from "./helpers/testUtils.js";
import { config } from "../src/config.js";
import { __test as storeTest } from "../src/sqliteStore.js";

test("SQLite vektör bilgi tabanı", async (t) => {
  const { store, tempDir, dbPath } = buildTestStore(config.docsDir);
  t.after(() => {
    store.close();
    removeTempDir(tempDir);
  });

  await t.test("tek dosyada 17 belge ve 30 pasaj saklar", () => {
    assert.equal(store.countDocuments(), 17);
    assert.equal(store.countPassages(), 30);
    assert.equal(fs.existsSync(dbPath), true);
  });
  await t.test("bütün pasajlarda embedding bulunur", () => {
    assert.equal(store.hasEmbeddings(), true);
    assert.equal(store.getMetadata("embedding_model"), "hash-test");
  });
  await t.test("vektör BLOB dönüşümü kayıpsızdır", () => {
    const vector = [0.1, -0.2, 0.3];
    const roundTrip = storeTest.blobToVector(storeTest.vectorToBlob(vector), 3);
    assert.equal(roundTrip.length, 3);
    roundTrip.forEach((value, i) => assert.ok(Math.abs(value - vector[i]) < 1e-6));
  });
  await t.test("anlamsal ve sözcüksel puanı birlikte kullanır", () => {
    const results = store.search({
      queryText: "IE 297 stajı kaç iş günü",
      queryEmbedding: hashEmbedding("IE 297 stajı kaç iş günü"),
      topK: 5,
    });
    assert.equal(results[0].docId, "staj-asamalari");
    assert.ok(results[0].semanticScore >= 0);
    assert.ok(results[0].lexicalScore > 0);
  });
  await t.test("embedding yoksa sözcüksel aramaya düşer", () => {
    const results = store.search({ queryText: "sigorta belgeleri", topK: 3 });
    assert.equal(results[0].docId, "basvuru-sigorta");
    assert.equal(results[0].semanticScore, 0);
  });
  await t.test("belgeleri pasaj sayısıyla listeler", () => {
    const docs = store.listDocuments();
    assert.equal(docs.length, 17);
    assert.ok(docs.every((doc) => doc.passageCount >= 1));
  });
});
