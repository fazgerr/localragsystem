import test from "node:test";
import assert from "node:assert/strict";
import {
  extractiveFallback,
  isDomainQuestion,
  isLikelyFollowUp,
  resolveQuestion,
  validateAnswer,
} from "../src/answerGuard.js";

const passages = [
  {
    passageId: "staj-asamalari::02",
    plainText: "IE 297, ikinci sınıftan üçüncü sınıfa geçen öğrenciler için 6 hafta ve 30 iş günüdür.",
    content: "",
  },
];

test("Kanıt ve konuşma güvenliği", async (t) => {
  await t.test("kanıttaki sayıları kabul eder", () => {
    const result = validateAnswer("IE 297 stajı 6 hafta ve 30 iş günüdür.", passages);
    assert.equal(result.valid, true);
  });
  await t.test("kanıtta olmayan sayıyı reddeder", () => {
    const result = validateAnswer("IE 297 stajı 7 gün sürer.", passages);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((item) => item.startsWith("unsupported-numbers")));
  });
  await t.test("modelin bilgi yok işaretini tanır", () => {
    const result = validateAnswer("BILGI_YOK", passages);
    assert.equal(result.valid, false);
    assert.ok(result.errors.includes("no-source"));
  });
  await t.test("prompt çerçevesini cevaba sızdırmayı reddeder", () => {
    const result = validateAnswer("Kullanıcı Talimat: IE 297 stajı 30 iş günüdür.", passages);
    assert.equal(result.valid, false);
    assert.ok(result.errors.includes("prompt-framing-leak"));
  });
  await t.test("staj sorusunu alan içi sayar", () => {
    assert.equal(isDomainQuestion("Staj sigortası için belge lazım mı?"), true);
  });
  await t.test("hava sorusunu alan dışı sayar", () => {
    assert.equal(isDomainQuestion("Bugün hava nasıl?"), false);
  });
  await t.test("kısa takip sorusunu tanır", () => {
    assert.equal(isLikelyFollowUp("peki nereye teslim edeceğim"), true);
  });
  await t.test("takip sorusunu yalnızca önceki kullanıcı sorusuyla birleştirir", () => {
    const resolved = resolveQuestion("peki nereye", [
      { role: "user", content: "Sigorta belgeleri neler?" },
      { role: "assistant", content: "Yanlış olabilecek cevap" },
    ]);
    assert.match(resolved, /Sigorta belgeleri neler/);
    assert.doesNotMatch(resolved, /Yanlış olabilecek cevap/);
  });
  await t.test("model yokken ilgili cümleleri doğrudan belgeden çıkarır", () => {
    const fallback = extractiveFallback("IE 297 kaç gün", passages);
    assert.match(fallback.answer, /30 iş günüdür/);
    assert.deepEqual(fallback.evidenceIds, ["staj-asamalari::02"]);
  });
});

test("aynı kaynakta bulunmayan ders kodu ve süre eşleşmesini reddeder", () => {
  const passages = [{ plainText: "IE 197 en az 20 iş günüdür. IE 297 en az 30 iş günüdür." }];
  const result = validateAnswer("IE 197 stajı 30 iş günüdür.", passages);
  assert.equal(result.valid, false);
  assert.ok(result.errors.includes("unsupported-claim-cooccurrence"));
});

test("aynı cümlede desteklenen ders kodu ve süreyi kabul eder", () => {
  const passages = [{ plainText: "IE 297 en az 30 iş günüdür." }];
  const result = validateAnswer("IE 297 stajı 30 iş günüdür.", passages);
  assert.equal(result.valid, true);
});

test("staj kelimesi yazılmayan sınıf geçişini alan içi kabul eder", () => {
  assert.equal(isDomainQuestion("1 den 2 ye geçerken kaç gün"), true);
});

test("kaynakta olmayan özneyi ekleyen cümleyi reddeder", () => {
  const passages = [{ section: "İş Yeri Seçimi", plainText: "Staj yerini bulma sorumluluğu öğrenciye aittir." }];
  const result = validateAnswer("Staj yerini bölüm bulur.", passages);
  assert.equal(result.valid, false);
  assert.ok(result.errors.includes("unsupported-text-claim"));
});

test("kaynak cümlesini doğal ve destekli biçimde kısaltmayı kabul eder", () => {
  const passages = [{ section: "İş Yeri Seçimi", plainText: "Staj yerini bulma sorumluluğu öğrenciye aittir." }];
  const result = validateAnswer("Staj yerini öğrenci bulur.", passages);
  assert.equal(result.valid, true);
});
