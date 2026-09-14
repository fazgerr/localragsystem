import test from "node:test";
import assert from "node:assert/strict";
import { QueryEngine } from "../src/queryEngine.js";
import { config } from "../src/config.js";
import { buildTestStore, hashEmbedding, removeTempDir } from "./helpers/testUtils.js";

class FakeRuntime {
  constructor({ answer = "", completeError = null, embedError = null } = {}) {
    this.answer = answer;
    this.completeError = completeError;
    this.embedError = embedError;
    this.embedCalls = 0;
    this.completeCalls = 0;
    this.status = null;
  }
  onStatus(callback) { this.status = callback; }
  async initialize() {}
  async embedOne(text) {
    this.embedCalls += 1;
    if (this.embedError) throw this.embedError;
    return hashEmbedding(text);
  }
  async complete() {
    this.completeCalls += 1;
    if (this.completeError) throw this.completeError;
    return this.answer;
  }
  async embedMany(texts) { return texts.map(hashEmbedding); }
  async close() {}
}

function setup(runtime) {
  const { store, tempDir } = buildTestStore(config.docsDir);
  const engine = new QueryEngine({ cfg: config, store, runtime });
  return { engine, store, tempDir };
}

async function cleanup(engine, tempDir) {
  await engine.close();
  removeTempDir(tempDir);
}

test("Kaynak doğrulamalı RAG işlem hattı", async (t) => {
  await t.test("doğru model cevabını kaynaklarla döndürür", async () => {
    const runtime = new FakeRuntime({ answer: "IE 297 stajı en az 6 hafta ve 30 iş günüdür." });
    const { engine, tempDir } = setup(runtime);
    try {
      const result = await engine.query("IE 297 stajı kaç gün?");
      assert.equal(result.grounded, true);
      assert.equal(result.reason, "model-grounded");
      assert.match(result.text, /30 iş günü/);
      assert.ok(result.sources.some((source) => source.docId === "staj-asamalari"));
    } finally { await cleanup(engine, tempDir); }
  });

  await t.test("birden fazla IE staj süresini model beklemeden derslerle eşler", async () => {
    const runtime = new FakeRuntime({ answer: "Bu cevap kullanılmamalı." });
    const { engine, tempDir } = setup(runtime);
    try {
      const result = await engine.query("IE 197, IE 297 ve IE 397 stajları ayrı ayrı kaç iş günüdür?");
      assert.equal(result.reason, "extractive-fast-path");
      assert.match(result.text, /IE 197[^.]*20 iş gün/i);
      assert.match(result.text, /IE 297[^.]*30 iş gün/i);
      assert.match(result.text, /IE 397[^.]*30 iş gün/i);
      assert.equal(runtime.completeCalls, 0);
    } finally { await cleanup(engine, tempDir); }
  });

  await t.test("yanlış ders-süre eşleşmesini kullanıcıya göstermez", async () => {
    const runtime = new FakeRuntime({ answer: "IE 197 stajı 30 iş günüdür." });
    const { engine, tempDir } = setup(runtime);
    try {
      const result = await engine.query("IE 197 stajı kaç gün?");
      assert.equal(result.grounded, true);
      assert.equal(result.reason, "extractive-fallback");
      assert.doesNotMatch(result.text, /IE 197[^.]*30 iş günü/i);
      assert.match(result.text, /20 iş gün/i);
    } finally { await cleanup(engine, tempDir); }
  });

  await t.test("model bilgi yok dediğinde uydurma cevap üretmez", async () => {
    const runtime = new FakeRuntime({
      answer: "BILGI_YOK",
      embedError: new Error("embedding unavailable"),
    });
    const { engine, tempDir } = setup(runtime);
    try {
      const result = await engine.query("2027 staj başvurusunun kesin son tarihi nedir?");
      assert.equal(result.grounded, false);
      assert.equal(result.reason, "no-source");
      assert.match(result.text, /yerel belge arşivinde bulunmuyor/i);
    } finally { await cleanup(engine, tempDir); }
  });

  await t.test("kaynakta olmayan stajyer maaşı için modeli çağırmaz", async () => {
    const runtime = new FakeRuntime({ answer: "Stajyer maaşı 25000 TL'dir." });
    const { engine, tempDir } = setup(runtime);
    try {
      const result = await engine.query("Stajyer maaşı tam olarak kaç TL?");
      assert.equal(result.grounded, false);
      assert.equal(result.reason, "no-source");
      assert.equal(runtime.completeCalls, 0);
    } finally { await cleanup(engine, tempDir); }
  });

  await t.test("model yanlışlıkla bilgi yok dese de güçlü doğrudan kanıtı kullanır", async () => {
    const runtime = new FakeRuntime({
      answer: "BILGI_YOK",
      embedError: new Error("embedding unavailable"),
    });
    const { engine, tempDir } = setup(runtime);
    try {
      const result = await engine.query("Mezun olmadan önce kaç ayrı staj bitirmeliyim?");
      assert.equal(result.grounded, true);
      assert.equal(result.reason, "extractive-fast-path");
      assert.match(result.text, /üç aşama|üç aşamayı/i);
      assert.equal(runtime.embedCalls, 0);
      assert.equal(runtime.completeCalls, 0);
    } finally { await cleanup(engine, tempDir); }
  });

  await t.test("chat modeli hata verirse doğrudan kaynak özetine düşer", async () => {
    const runtime = new FakeRuntime({ completeError: new Error("model unavailable") });
    const { engine, tempDir } = setup(runtime);
    try {
      const result = await engine.query("Staj sigortası için hangi belgeler gerekli?");
      assert.equal(result.reason, "extractive-fallback");
      assert.equal(result.grounded, true);
      assert.ok(result.sources.length >= 1);
    } finally { await cleanup(engine, tempDir); }
  });

  await t.test("embedding hata verirse sözcüksel aramayla güvenli biçimde devam eder", async () => {
    const runtime = new FakeRuntime({
      answer: "IE 297 stajı en az 6 hafta ve 30 iş günüdür.",
      embedError: new Error("embedding unavailable"),
    });
    const { engine, tempDir } = setup(runtime);
    try {
      const result = await engine.query("IE 297 stajı kaç gün?");
      assert.equal(result.grounded, true);
      assert.equal(result.retrieval.mode, "lexical-fallback");
    } finally { await cleanup(engine, tempDir); }
  });

  await t.test("alan dışı soruda hiçbir model çağrısı yapmaz", async () => {
    const runtime = new FakeRuntime({ answer: "Bugün hava güneşli." });
    const { engine, tempDir } = setup(runtime);
    try {
      const result = await engine.query("Bugün Kayseri'de hava nasıl?");
      assert.equal(result.reason, "out-of-scope");
      assert.equal(runtime.embedCalls, 0);
      assert.equal(runtime.completeCalls, 0);
    } finally { await cleanup(engine, tempDir); }
  });

  await t.test("kısa takip sorusunda yalnızca önceki kullanıcı sorusunu bağlama ekler", async () => {
    const runtime = new FakeRuntime({ answer: "IE 297 stajı 3 AKTS'dir." });
    const { engine, tempDir } = setup(runtime);
    try {
      const result = await engine.query("AKTS'si kaç?", [
        { role: "user", content: "IE 297 stajı kaç gün?" },
        { role: "assistant", content: "Yanlış bir önceki cevap" },
      ]);
      assert.equal(result.grounded, true);
      assert.match(result.text, /3 AKTS/i);
    } finally { await cleanup(engine, tempDir); }
  });
});

test("kaynakta bulunmayan stajı bölme kuralında ilgisiz extractive cevap vermez", async () => {
  const runtime = new FakeRuntime({ answer: "Staj 15+15 gün olarak bölünebilir." });
  const { engine, tempDir } = setup(runtime);
  try {
    const result = await engine.query("30 günlük stajı ikiye bölebilir miyim?");
    assert.equal(result.grounded, false);
    assert.match(result.text, /yerel belge arşivinde bulunmuyor/i);
  } finally { await cleanup(engine, tempDir); }
});

test("kanıtta olmayan açık yılı model çağrısından önce reddeder", async () => {
  const runtime = new FakeRuntime({ answer: "Son tarih 29.09.2025'tir." });
  const { engine, tempDir } = setup(runtime);
  try {
    const result = await engine.query("2027 staj başvurusunun kesin son tarihi nedir?");
    assert.equal(result.reason, "no-source");
    assert.equal(runtime.completeCalls, 0);
  } finally { await cleanup(engine, tempDir); }
});
