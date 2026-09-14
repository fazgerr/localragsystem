import test from "node:test";
import assert from "node:assert/strict";
import {
  cosineSimilarity,
  extractNumberTokens,
  normalizeText,
  splitSentences,
  tokenize,
} from "../src/text.js";

test("Türkçe metin normalizasyonu", async (t) => {
  await t.test("Türkçe karakterleri arama için katlar", () => {
    assert.equal(normalizeText("İşyeri, ölçüt ve değerlendirme"), "isyeri olcut ve degerlendirme");
  });
  await t.test("IE ders kodunu standartlaştırır", () => {
    assert.equal(normalizeText("IE-297 kaç gün?"), "ie297 kac gun");
  });
  await t.test("sınıf geçişini normalize eder", () => {
    assert.match(normalizeText("1'den 2'ye geçerken"), /1 2 gec/);
  });
  await t.test("eş anlamlı staj terimlerini ortaklaştırır", () => {
    assert.deepEqual(tokenize("bütün stajlarım kaç tane"), ["toplam", "staj", "sayi"]);
  });
  await t.test("cümleleri ayırır", () => {
    assert.deepEqual(splitSentences("Birinci cümle burada. İkinci cümle burada!"), [
      "Birinci cümle burada.",
      "İkinci cümle burada!",
    ]);
  });
  await t.test("kosinüs benzerliğini doğru hesaplar", () => {
    assert.equal(cosineSimilarity([1, 0], [1, 0]), 1);
    assert.equal(cosineSimilarity([1, 0], [0, 1]), 0);
  });
  await t.test("sayısal iddiaları çıkarır", () => {
    assert.deepEqual([...extractNumberTokens("30 iş günü ve %40 rapor")].sort(), ["30", "40"]);
  });
});
