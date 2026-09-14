import test from "node:test";
import assert from "node:assert/strict";
import { normalizeText, tokenize, wordCount, splitSentences } from "../src/text.js";
import {
  isDomainQuestion,
  isLikelyFollowUp,
  resolveQuestion,
  trimToWords,
} from "../src/answerGuard.js";

test("Metin işleme (text.js) birimi", async (t) => {
  await t.test("normalizeText Türkçe karakterleri ve hyphenleri normalleştirir", () => {
    assert.equal(normalizeText("STAJ"), "staj");
    assert.equal(normalizeText("Ğ-Ü"), "g-u");
    assert.equal(normalizeText("IE-297"), "ie297");
    assert.equal(normalizeText("  çoklu   boşluk  "), "coklu bosluk");
  });

  await t.test("tokenize metni kelime listesine ayırır", () => {
    const tokens = tokenize("IE 297 staj programı");
    assert.ok(tokens.includes("ie297"));
    assert.ok(tokens.includes("staj"));
  });

  await t.test("wordCount sözcük sayısını döner", () => {
    assert.equal(wordCount("bir iki üç dört"), 4);
    assert.equal(wordCount(""), 0);
    assert.equal(wordCount("  "), 0);
  });

  await t.test("splitSentences cümleleri ayırır", () => {
    const sentences = splitSentences("Birinci cümle. İkinci cümle? Üçüncü cümle!");
    assert.equal(sentences.length, 3);
    assert.ok(sentences.some((s) => s.includes("Birinci cümle")));
  });
});

test("Cevap doğrulama (answerGuard.js) birimi", async (t) => {
  await t.test("isDomainQuestion staj sorularını tanır", () => {
    assert.ok(isDomainQuestion("IE 297 kaç gün?"));
    assert.ok(isDomainQuestion("Staj raporu kaç sayfa?"));
    assert.ok(isDomainQuestion("Sigorta ne zaman başlar?"));
    assert.ok(!isDomainQuestion("Yazın hava ne kadar sıcak?"));
    assert.ok(!isDomainQuestion("En iyi pizza nerede?"));
  });

  await t.test("isLikelyFollowUp takip sorularını tanır", () => {
    assert.ok(isLikelyFollowUp("Peki ya kalıtım?"));
    assert.ok(isLikelyFollowUp("Kaç gün?"));
    assert.ok(isLikelyFollowUp("Nereye?"));
    assert.ok(!isLikelyFollowUp("IE 297 hakkında bilgi verir misin?"));
  });

  await t.test("resolveQuestion geçmiş soruları kullanarak takip sorusunu tamamlar", () => {
    const history = [
      { role: "user", content: "IE 297 ne?" },
      { role: "assistant", content: "..." },
    ];
    const resolved = resolveQuestion("Peki ya IE 397?", history);
    assert.ok(resolved.includes("IE 297"));
    assert.ok(resolved.includes("IE 397"));
  });

  await t.test("trimToWords yanıtı sözcük limitine göre kırpar", () => {
    const long = "bir iki üç dört beş altı yedi sekiz dokuz on";
    const trimmed = trimToWords(long, 5);
    assert.ok(trimmed.split(" ").length <= 5);
  });

  await t.test("trimToWords modelin HTML boşluk kodlarını temizler", () => {
    assert.equal(trimToWords("Kaynaklı cevap. &#x20;", 20), "Kaynaklı cevap.");
  });
});
