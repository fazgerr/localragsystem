import test from "node:test";
import assert from "node:assert/strict";
import { buildTestStore, hashEmbedding, removeTempDir } from "./helpers/testUtils.js";
import { config } from "../src/config.js";

const CASES = [
  ["kaç tane zorunlu staj var", ["amac-kapsam"]],
  ["mezun olmadan önce kaç ayrı staj bitirmeliyim", ["amac-kapsam"]],
  ["tüm stajların iş günü toplamı", ["amac-kapsam", "staj-asamalari"]],
  ["birinci sınıf bitti staj kaç gün", ["staj-asamalari"]],
  ["1. sınıftan 2. sınıfa geçişte hangi staj", ["staj-asamalari"]],
  ["ikinci sınıfı tamamladım yaz stajım ne kadar", ["staj-asamalari"]],
  ["2 den 3 e geçiş stajı", ["staj-asamalari"]],
  ["üçüncü sınıf sonrası staj süresi", ["staj-asamalari"]],
  ["ie397 süresi ve akts", ["staj-asamalari"]],
  ["haftada kaç gün çalışabilirim", ["staj-asamalari", "sure-zaman"]],
  ["stajda hastalandım rapor günleri ne olur", ["sure-zaman"]],
  ["sağlık raporu staj süresine ekleniyor mu", ["sure-zaman"]],
  ["staj dönem içinde yapılabilir mi", ["sure-zaman"]],
  ["izin almak için kime yazmalıyım", ["sure-zaman", "sorumluluklar"]],
  ["işletmeyi kendim mi bulacağım", ["on-kosullar"]],
  ["firma uygunluğunu kim onaylıyor", ["on-kosullar"]],
  ["staj başvurusundan önce ne gerekli", ["on-kosullar", "basvuru-sigorta"]],
  ["sigorta evrakı neler", ["basvuru-sigorta"]],
  ["sgk işlemleri için belgeler", ["basvuru-sigorta"]],
  ["staj kabul formu ve kimlik fotokopisi nereye", ["basvuru-sigorta", "kabul-formu"]],
  ["stajda öğrencinin sorumlulukları", ["sorumluluklar"]],
  ["işyeri danışmanı ne yapar", ["sorumluluklar"]],
  ["stajdan sonra hangi dosyaları vereceğim", ["teslim-degerlendirme", "is-akisi"]],
  ["staj notunun yüzde dağılımı", ["teslim-degerlendirme"]],
  ["rapor sunum şirket değerlendirmesi oranları", ["teslim-degerlendirme"]],
  ["rapor yazı tipi kaç punto", ["rapor-format"]],
  ["staj raporu sayfa numarası nasıl", ["rapor-format"]],
  ["raporun ana başlıkları", ["rapor-format"]],
  ["staj kabul formunu kim imzalıyor", ["kabul-formu"]],
  ["firma formda hangi alanları doldurur", ["kabul-formu"]],
  ["işveren beni hangi kriterlerle puanlar", ["degerlendirme-formu"]],
  ["devamsızlık değerlendirme formunda soruluyor mu", ["degerlendirme-formu"]],
  ["stajdan önce sırasıyla ne yapacağım", ["is-akisi"]],
  ["staj videosunu ne zaman yükleyeceğim", ["is-akisi"]],
  ["isteğe bağlı staj sigortası", ["gonullu-yasal"]],
  ["gönüllü staj evrakları", ["gonullu-yasal"]],
  ["rapor metodoloji kaç puan", ["rapor-rubrigi"]],
  ["literatür taraması rapor puanı", ["rapor-rubrigi"]],
  ["sunum içeriği kaç puan", ["sunum-rubrigi"]],
  ["sunum görsel değerlendirme", ["sunum-rubrigi"]],
  ["şekil başlığı üstte mi altta mı", ["rapor-detaylari"]],
  ["kaynakçada kullanılmayan kaynak olur mu", ["rapor-detaylari"]],
  ["giriş en fazla kaç sayfa", ["rapor-detaylari"]],
  ["resmi tatil iş günü sayılır mı", ["prosedur-ayrintilari"]],
  ["geç teslim edersem staj ne olur", ["prosedur-ayrintilari", "teslim-degerlendirme"]],
  ["staj sonucuna itiraz", ["prosedur-ayrintilari"]],
  ["başarısız stajı tekrar etmek", ["prosedur-ayrintilari"]],
  ["kişisel veriler hangi kuruma gönderilir", ["kvkk-form-bilgileri"]],
  ["kvkk başvurusunu nasıl yaparım", ["kvkk-form-bilgileri"]],
  ["staj formunda hangi kişisel bilgiler var", ["kvkk-form-bilgileri"]],
];

test("Doğal Türkçe sorularda genel belge geri çağırma", async (t) => {
  const { store, tempDir } = buildTestStore(config.docsDir);
  t.after(() => {
    store.close();
    removeTempDir(tempDir);
  });

  for (const [query, expectedDocIds] of CASES) {
    await t.test(query, () => {
      const results = store.search({
        queryText: query,
        queryEmbedding: hashEmbedding(query),
        topK: 6,
        semanticWeight: config.semanticWeight,
        lexicalWeight: config.lexicalWeight,
      });
      const topIds = results.slice(0, 4).map((item) => item.docId);
      assert.ok(
        expectedDocIds.some((id) => topIds.includes(id)),
        `Beklenen ${expectedDocIds.join(" veya ")}; ilk dört: ${topIds.join(", ")}`
      );
    });
  }
});
