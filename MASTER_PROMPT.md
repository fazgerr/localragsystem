# MASTER PROMPT — AGÜ STAJ ASİSTANI'NIN SIFIRDAN YENİDEN GELİŞTİRİLMESİ

Sen bu konuşmaya yeni başladın. Proje hakkında önceden hiçbir bilgiye sahip olduğunu varsayma. Bu klasördeki dosyaları inceleyerek AGÜ Endüstri Mühendisliği için çalışan, kaynak doğrulamalı, tamamen yerel bir Staj Asistanı uygulamasını sıfırdan geliştir.

ÖNEMLİ: Aşağıdaki gereksinimler, önceki geliştirme çalışmasından ve mevcut kaynaklardan çıkarılmış kabul kriterleridir. Bunları Barbaros Bey'in birebir söylediği cümleler olarak sunma. Kaynaklarda veya bu promptta açıkça belirtilmeyen bir şeyi uydurma. Bir gereksinim kaynakta desteklenmiyorsa bunu açıkça belirt ve varsayım yapma.

---

## 1. PROJENİN AMACI

AGÜ Endüstri Mühendisliği öğrencilerinin staj süreciyle ilgili sorularını cevaplayan bir masaüstü/yerel web uygulaması geliştirilecek.

Uygulama şunları yapmalı:
1. Öğrencinin Türkçe doğal dilde sorduğu soruyu anlamalı.
2. Yerel bilgi tabanında ilgili kaynak pasajlarını bulmalı.
3. Yalnızca bulunan kaynak kanıtlarına dayanarak cevap üretmeli.
4. Cevabı kullanıcıya anlaşılır Türkçe ile vermeli.
5. Cevaptaki sayıları, tarihleri, yüzdeleri, süreleri ve kritik iddiaları kanıtlarla doğrulamalı.
6. Kanıt bulunmuyorsa kesin cevap üretmemeli.
7. Kapsam dışı soruları güvenli şekilde reddetmeli.
8. Çalışma sırasında internetten bilgi aramamalı ve kullanıcı/şirket verisini dış servislere göndermemeli.

Bu bir genel amaçlı chatbot değildir. AGÜ staj belgeleri üzerinde çalışan kaynak doğrulamalı bir RAG (Retrieval-Augmented Generation) sistemidir.

---

## 2. KANONİK KAYNAKLAR

`source/original` değil, bu paketteki `sources/original/` klasörünü kullan.

Kanonik dosyalar:
- IE_InReportTemplate.docx
- IE_Stajyer_Formu.docx
- IE_STAJ_PROGRAMI_KILAVUZU (TR) - 29.09.2025 (1).docx
- Staj Formu Güncel.docx
- staj2025-05-15 173635.jpg

Bu dosyaların içerikleri değiştirilmemeli.

`sources/extracted/` içindeki metinler RAG ingestion için kullanılabilir. Ancak extracted metin ile orijinal dosya arasında uyuşmazlık olursa orijinal kaynak esas alınmalı ve extraction düzeltilmelidir.

`docs/` klasörü, kaynakların daha önce hazırlanmış konu bazlı ayrıştırılmış bilgi tabanıdır. Yeni sistem bunu referans olarak kullanabilir; fakat kaynak doğrulamasının son otoritesi orijinal kaynaklardır.

---

## 3. KAYNAK KONULARI

Mevcut bilgi tabanında aşağıdaki konular bulunmaktadır:
- programın amacı ve kapsamı
- IE 197 / IE 297 / IE 397 aşamaları ve süreleri
- staj zamanı, izin ve sağlık raporu
- staj ön koşulları ve iş yeri seçimi
- başvuru, sigorta ve belgeler
- öğrenci / işyeri danışmanı / akademik danışman sorumlulukları
- staj sonrası teslimler ve değerlendirme
- rapor formatı ve bölümleri
- staj kabul formu
- stajyer değerlendirme formu
- staj süreci iş akışı
- gönüllü staj ve yasal hükümler
- rapor değerlendirme rubriği
- sunum değerlendirme rubriği
- rapor içeriği, şekil, tablo ve kaynakça ayrıntıları
- resmî tatil, teslim, itiraz ve başarısızlık
- KVKK ve kişisel veri bilgileri

---

## 4. BİLİNEN KAYNAK BİLGİLERİ

Kaynaklarda açıkça bulunan örnek gerçekler:
- Staj programı IE 197, IE 297 ve IE 397 olmak üzere üç aşamadan oluşur.
- Toplam asgari yük 80 iş günü ve 16 haftadır; toplam yük 10 AKTS'dir.
- IE 197: en az 4 hafta / 20 iş günü / 2 AKTS.
- IE 297: en az 6 hafta / 30 iş günü / 3 AKTS.
- IE 397: en az 6 hafta / 30 iş günü / 5 AKTS.
- Haftada en fazla 6 gün çalışılabilir.
- Hastalık/yaralanma nedeniyle raporlu günler staj süresine eklenir; rapor süresinin toplam staj süresinin %30'unu geçmesiyle ilgili özel hüküm vardır.
- Staj yeri öğrenci tarafından bulunur ancak uygunluk Staj Programı Komisyonunca onaylanır.
- Sigorta ve başvuru için kaynaklarda belirtilen belgeler hazırlanmalıdır.
- Final raporu %40, final sunumu %40, işyeri danışmanı değerlendirmesi %20 olarak verilmiştir.
- Rapor değerlendirme rubriğinde Dil Kullanımı 20, Giriş 10, Problem Tanımı 15, Literatür Taraması 10, Metodoloji 35, Tartışma 10 puandır.
- Sunum rubriğinde Anlatım 20, Organizasyon ve Zamanlama 20, Görseller 20, İçerik 40 puandır.
- Rapor şablonunda Times New Roman 12 punto, 1,5 satır aralığı ve diğer biçim kuralları belirtilmiştir.

Bu liste eksiksiz değildir. Cevap verirken gerçek kaynak pasajlarını retrieval ile kullan.

---

## 5. MİMARİ

Önerilen mimari:

USER QUESTION
→ input validation
→ Turkish text normalization / query analysis
→ embedding
→ SQLite semantic retrieval
→ evidence selection
→ local chat model
→ answer parser
→ evidence/claim validator
→ gerekirse düzeltme veya güvenli fallback
→ HTTP/UI response

Teknolojiler:
- Node.js ESM
- Node sürümü: >=22.13.0 ve <24
- Microsoft Foundry Local
- Foundry Local SDK 1.2.0
- Windows yerel çekirdeği / WinML dependency
- embedding modeli: qwen3-embedding-0.6b
- embedding boyutu mevcut implementasyonda 1024
- chat modeli: qwen2.5-0.5b
- SQLite
- yerel web arayüzü / HTTP API

Ancak sürümleri körü körüne kopyalama: package-lock ve çalışan dependency sürümlerini test ederek sabitle.

---

## 6. FOUNDRY LOCAL WINDOWS SORUNU

Önceki Windows kurulumunda şu hata görüldü:
`Cannot find module '@foundry-local-core/win32-x64/package.json'`

Daha sonra native dependency kuruldu ancak `onnxruntime.dll` yüklenemedi. Sorunun çözümünde proje klasörü OneDrive altında değil, kullanıcı klasörü altında normal bir klasöre kopyalandığında:
`C:\Users\fatih\AGU-Staj-Asistani-v4.0.1`

`npm run check:foundry` başarılı oldu.

Bu nedenle yeni projeyi şirket bilgisayarında OneDrive/senkronizasyon klasörünün içine zorunlu olarak kurma. Windows native DLL'lerin çalışabileceği normal lokal klasör öner.

Kurulum script'i şunları açık ve kontrollü yapmalı:
1. Node sürümünü kontrol et.
2. npm sürümünü kontrol et.
3. Foundry Local dependency'lerini kur.
4. native dependency install scriptlerinin çalışmasına izin ver.
5. Foundry check çalıştır.
6. embedding modelini indir/yükle.
7. ingestion çalıştır.
8. testleri çalıştır.
9. diagnose sonucu üret.
10. server'ı başlat.

Native DLL sorunlarında rastgele DLL kopyalamak yerine resmi package install/rebuild akışını kullan.

---

## 7. INGESTION

`npm run ingest` benzeri tek bir komut olmalı.

Ingestion sırasında:
- orijinal kaynak dosyaları oku
- DOCX paragraflarını ve tablolarını çıkar
- görsel kaynağı OCR ile metne dönüştür
- belge metadata'sı oluştur
- başlık bazlı veya kararlı pasajlar oluştur
- duplicate içerikleri temizle
- pasajlara stable ID ver
- kaynak dosyası ve bölüm ilişkisini sakla
- embedding oluştur
- embeddingleri SQLite'a yaz
- manifest/hash kontrolünü yap

İşlem sonunda şu bilgiler açıkça gösterilmeli:
- kaç belge bulundu
- kaç pasaj üretildi
- embedding modeli
- embedding boyutu
- SQLite DB yolu
- başarısız extraction varsa hangileri

---

## 8. RETRIEVAL

Retrieval yalnızca keyword matching olmamalı.

Türkçe sorular için:
- küçük/büyük harf normalizasyonu
- Türkçe karakterlerin korunması
- ek varyasyonları için normalization
- yazım hatalarına sınırlı dayanıklılık
- semantik embedding similarity
- mümkünse metadata/category boost
- relevance threshold

Örnekler:
- `stajda öğrencinin sorumlulukları` → sorumluluklar
- `işyeri danışmanı ne yapar` → sorumluluklar
- `stajdan sonra hangi dosyaları vereceğim` → teslim/değerlendirme veya iş akışı
- `rapor yazı tipi kaç punto` → rapor formatı
- `metodoloji kaç puan` → rapor rubriği
- `resmi tatil iş günü sayılır mı` → prosedür ayrıntıları

Soru farklı yazılsa bile ilgili belge bulunmalı.

---

## 9. KANIT DOĞRULAMA — EN ÖNEMLİ KISIM

Modelin doğru görünen ama kaynakta bulunmayan cevap üretmesine izin verme.

Her cevap için:
- claims listesi oluştur
- her claim için evidence passage ID sakla
- claim ile evidence arasında semantic/lexical ilişki kontrolü yap
- sayı/tarih/yüzde/süre gibi değerleri doğrudan evidence üzerinden kontrol et
- evidence'ta olmayan sayıyı reddet
- evidence'ta olmayan tarihi reddet
- source dışı kesin iddiayı reddet
- cevapta bulunup claims listesinde olmayan kritik cümleyi reddet
- alakasız evidence ile desteklenmiş görünen claim'i reddet

Önceki testlerde şu güvenlik davranışları doğrulandı:
- olmayan passage ID elenir
- kanıt sayılarıyla yapılan basit hesap doğrulanır
- kanıtta olmayan sayı engellenir
- tekrarlı paragraf temizlenir
- claims listesinde izlenmeyen cevap cümlesi engellenir
- tamamen alakasız evidence reddedilir
- çok sayıda kaynak dışı sayı engellenir
- validator'ın yanlış düzeltmesi ikinci kontrolden geçmezse kabul edilmez

Bu davranışları yeniden oluştur.

---

## 10. MODELİN BİLGİ UYDURMASINI ENGELLE

Sistem promptunda açıkça şunu uygula:
- Kaynaklarda yoksa `Bu bilgi yerel belge arşivinde bulunmuyor.` benzeri güvenli fallback kullan.
- Güncel duyuru, son tarih, komisyon kararı, kişisel durum gibi kaynakta olmayan konularda internetten tahmin yapma.
- Kullanıcı ısrar etse bile kaynakta olmayan bilgiyi üretme.
- Genel dünya bilgisini AGÜ staj kuralı gibi sunma.
- Kaynaklar çelişirse çelişkiyi göster ve hangi belgede ne yazdığını belirt.

---

## 11. KAPSAM DIŞI SORULAR

Sistem sadece AGÜ Endüstri Mühendisliği staj süreçleriyle ilgili sorulara cevap vermeli.

Örneğin:
- hava durumu
- futbol
- genel kodlama
- genel sağlık
- genel hukuk
- şirket içi gizli bilgiler

gibi sorulara staj asistanı kapsamında olmadığı belirtilerek güvenli cevap verilmeli.

Kapsam dışı soruda modeli gereksiz yere çağırma.

---

## 12. HTTP API

Minimum:
- health endpoint
- readiness endpoint
- chat endpoint
- güvenli input validation
- boş soru reddi
- aşırı uzun soru reddi
- geçersiz dosya uzantısı reddi
- kaynak dosyası yükleme gerekiyorsa güvenli filename sanitization

API hazır olmadan chat isteğine cevap vermemeli.

---

## 13. DOSYA VE KİŞİSEL VERİ GÜVENLİĞİ

Şirket bilgisayarında çalışacak.

Kesin kurallar:
- kullanıcı soruları dış API'ye gönderilmez
- kaynak belgeler dışarı gönderilmez
- şirket verisi loglara yazılmaz
- hassas içerik debug loglarında gösterilmez
- dosya path traversal engellenir
- sadece izin verilen dosya türleri işlenir
- yükleme varsa boyut limiti vardır
- model promptuna gereksiz kişisel veri sokulmaz
- telemetry/analytics eklenmez

---

## 14. UI

Basit ve işlevsel bir arayüz yeterli.

Şunlar görünmeli:
- soru giriş alanı
- cevap
- mümkünse kullanılan kaynaklar / belge adları
- sistem hazır mı bilgisi
- loading durumu
- hata durumu

Kaynak pasajlarının tamamını gereksiz şekilde kullanıcıya dökme; ancak cevap doğrulanabilir olmalı.

---

## 15. TESTLER

Testleri yalnızca happy-path yazma.

En az şu senaryoları test et:

### Retrieval
- `IE 297 kaç iş günü`
- `2 den 3 e geçiş stajı`
- `rapor fontu ve punto ne`
- `metodoloji rapor puanının yüzde kaçı`
- `sunum görselleri kaç puan`
- `resmi tatil stajdan düşüyor mu`
- `staj formunu firma mı dolduruyor`
- `stajdan sonra ne yükleyeceğiz`

### Doğrulama
- kanıtta olmayan 7 gün gibi uydurma sayı
- kanıtta olmayan tarih
- kanıtta olmayan yüzde
- yanlış passage ID
- alakasız passage
- validator'ın yanlış düzeltmesi

### Model hata
- JSON parse failure
- model timeout/failure
- soru analizi failure
- boş response

### HTTP
- server hazır değilken request
- boş soru
- çok uzun soru
- geçersiz upload
- güvenlik headerları

### Integrity
- manifest hash
- eksik kaynak
- duplicate source ID
- değişmiş kaynak

---

## 16. DIAGNOSTIC / DEMO KOMUTLARI

Proje en az şu komutlara sahip olsun:

`npm install`
`npm run check:foundry`
`npm run ingest`
`npm test`
`npm run diagnose`
`npm start`

İsteğe bağlı:
`npm run live-eval`

`npm run setup` varsa tüm güvenli kurulum/test adımlarını deterministik biçimde çalıştırmalı.

---

## 17. KURULUM DENEYİMİ

Yeni bir kullanıcı bu projeyi hiçbir şey bilmiyormuş gibi çalıştırabilmeli.

README'de:
1. Node kurulumu
2. proje klasörü
3. npm install
4. Foundry native dependency
5. check
6. ingest
7. test
8. start
9. browser URL
10. troubleshooting

adımları tek tek yaz.

Windows için PowerShell komutları ver.

OneDrive gibi senkronizasyon klasörlerinde native DLL sorunları yaşanabildiğini not et; mümkünse `C:\Users\<kullanıcı>\AGU-Staj-Asistani` gibi normal lokal klasör öner.

---

## 18. KOD KALİTESİ

- ESM kullan.
- Fonksiyonları küçük tut.
- İş mantığını HTTP katmanına gömme.
- retrieval ve validation ayrı modüller olsun.
- kaynak parsing ve ingestion ayrı olsun.
- Foundry runtime tek yerde yönetilsin.
- hata mesajları kullanıcıya anlaşılır, loglar geliştiriciye faydalı olsun.
- sırf testi geçirmek için hard-code cevap tablosu yazma.
- test sorularını production retrieval yerine doğrudan map etme.
- kaynak içeriklerini kod içine kopyalayıp RAG'ı bypass etme.

---

## 19. ESKİ IMPLEMENTASYONU NASIL KULLANACAKSIN

Bu pakette `src/` ve `test/` altında önceki v4.0.1 implementasyonu var.

Bunu:
- davranış referansı
- hata senaryosu referansı
- test kapsamı referansı
- Foundry entegrasyon referansı

olarak incele.

Ancak doğrudan eski kodu olduğu gibi kabul etme. Yeni mimariyi temiz şekilde oluştur.

Önceki sürümde `134 test / 134 pass` görüldü, fakat daha sonra Foundry Local native DLL ve kaynak retrieval sorunları yaşandı. Dolayısıyla "testler geçti = sistem tamam" yaklaşımı kullanma.

---

## 20. TESLİM EDİLECEKLER

Çalışmayı bitirdiğinde proje klasörü en az şunları içermeli:

- package.json
- package-lock.json
- README.md
- kurulum/troubleshooting dokümanı
- src/
- test/
- docs/
- sources/original/
- sources/extracted/
- sources/manifest.json
- data/ (SQLite DB gerekiyorsa; büyük model cache'leri zip'e dahil edilmemeli)

Ayrıca:
- test sonucu
- Foundry check sonucu
- ingestion sonucu
- diagnose sonucu
- örnek soru-cevap değerlendirmesi

üret.

---

## 21. ÇALIŞMA SIRASI

Bu sırayı takip et:

PHASE 1 — DOSYALARI İNCELE
- Tüm kaynakları oku.
- Tüm docs dosyalarını oku.
- Mevcut src/test kodunu incele.
- package.json'ı incele.
- manifesti doğrula.

PHASE 2 — KAYNAK MODELİ
- Kaynakları normalize et.
- DOCX + tablo + OCR metin extraction yap.
- duplicate kaynakları tespit et.
- canonical source IDs oluştur.

PHASE 3 — RAG
- SQLite schema
- ingestion
- embeddings
- retrieval
- metadata filtering

PHASE 4 — LOCAL MODEL
- Foundry Local runtime
- embedding model
- chat model
- startup/readiness

PHASE 5 — ANSWER GUARD
- structured answer
- claims
- evidence IDs
- numeric validation
- source relevance validation
- safe fallback

PHASE 6 — API/UI
- health/readiness
- chat
- simple UI

PHASE 7 — TEST
- unit
- integration
- retrieval
- integrity
- live local model tests

PHASE 8 — WINDOWS VALIDATION
- normal local directory
- native dependency check
- ingest
- start

PHASE 9 — FINAL AUDIT
Aşağıdakilerin her birine cevap ver:
- Sistem tamamen local mi?
- Harici LLM çağrısı var mı?
- Kaynaksız sayı üretilebiliyor mu?
- Kaynakta olmayan tarih üretilebiliyor mu?
- Kaynak manifesti kontrol ediliyor mu?
- Duplicate kaynak sorunu var mı?
- Model çalışmazsa güvenli fallback var mı?
- Scope dışı soru modele gönderiliyor mu?
- Şirket verisi dışarı çıkıyor mu?
- Temiz kurulum tek README ile yapılabiliyor mu?

---

## 22. EN ÖNEMLİ KURAL

Çalışan ama kaynaksız cevap veren chatbot istemiyorum.

Öncelik sırası:
1. Kaynak doğruluğu
2. Yerel çalışma / veri gizliliği
3. Retrieval doğruluğu
4. Kanıt doğrulama
5. Güvenilir fallback
6. Kullanıcı deneyimi

Bir cevap üretmek uğruna bilgi uydurma.

Kaynakta yoksa: yok de.
Kaynakta varsa: doğru pasajı bul ve ona dayan.
Kaynaklar çelişiyorsa: çelişkiyi belirt.

Projeyi bu prensiplere göre sıfırdan oluştur ve sonunda tüm testleri çalıştır. Başarısız olan bir testi gizleme veya hard-code ile susturma. Hangi testin neden başarısız olduğunu açıkça raporla.
