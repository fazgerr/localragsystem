import test from "node:test";
import assert from "node:assert/strict";
import { markdownToPassages, parseFrontMatter } from "../src/documentParser.js";

test("Markdown belge ayrıştırma", async (t) => {
  await t.test("front matter alanlarını okur", () => {
    const parsed = parseFrontMatter("---\nid: deneme\ntitle: Başlık\n---\nİçerik");
    assert.equal(parsed.meta.id, "deneme");
    assert.equal(parsed.meta.title, "Başlık");
    assert.equal(parsed.body.trim(), "İçerik");
  });
  await t.test("başlık bazlı kararlı pasajlar üretir", () => {
    const parsed = markdownToPassages({
      filename: "ornek.md",
      markdown: "---\nid: ornek\ntitle: Örnek\ncategory: Test\n---\n# Bir\nİlk paragraf yeterince uzundur.\n\n# İki\nİkinci paragraf yeterince uzundur.",
    });
    assert.equal(parsed.document.docId, "ornek");
    assert.equal(parsed.passages.length, 2);
    assert.deepEqual(parsed.passages.map((p) => p.passageId), ["ornek::01", "ornek::02"]);
  });
  await t.test("uzun bölümü örtüşmeli parçalara böler", () => {
    const words = Array.from({ length: 80 }, (_, i) => `kelime${i}`).join(" ");
    const parsed = markdownToPassages({
      filename: "uzun.md",
      markdown: `---\nid: uzun\ntitle: Uzun\n---\n# Bölüm\n${words}`,
      maxWords: 30,
      overlapWords: 5,
    });
    assert.ok(parsed.passages.length >= 3);
    assert.ok(parsed.passages.every((p) => p.wordCount <= 30));
  });
});
