# AGÜ IE Staj Asistanı

Abdullah Gül Üniversitesi (AGÜ) Endüstri Mühendisliği Bölümü staj belgeleri üzerinde çalışan, tamamen yerel ve kaynak doğrulamalı RAG uygulaması. Sistem yalnızca AGÜ Endüstri Mühendisliği staj süreçleri için tasarlanmıştır.

**Sürüm:** 4.0.6  
**Çalışma ortamı:** Windows x64, Node.js `>=22.13.0 <24`

## Ne yapar?

- Türkçe staj soruları için Foundry Local ile embedding üretir.
- 17 yapılandırılmış belge ve 30 pasajdan oluşan SQLite bilgi tabanında hibrit arama yapar.
- Yerel `qwen2.5-0.5b` modeliyle cevap üretir.
- Cevaptaki sayı, tarih, oran ve kritik iddiaları seçilen kanıtlarla denetler.
- Modelin cevabı doğrulanamazsa doğrudan kaynak cümlelerine veya güvenli “bilgi yok” cevabına döner.
- Kapsam dışı soruları model çağrısı yapmadan reddeder.

Çalışma zamanında harici LLM/API kullanılmaz; sorular ve belgeler dış servislere gönderilmez. İlk kurulum ve model indirme sırasında internet gerekir.

## Gereksinimler

- Windows x64
- Node.js 22 LTS (`22.13.0` veya üzeri, `24.0.0`'dan düşük)
- Güncel Visual C++ Redistributable
- Model indirmeleri için ilk kurulum sırasında internet bağlantısı

Projeyi OneDrive/SharePoint gibi senkronizasyon klasörleri yerine örneğin `C:\Users\<kullanıcı>\AGU-Staj-Asistani` altına çıkarın.

## Kurulum ve doğrulama

İlk kurulum için `KURULUM.cmd`, sonraki kullanımlar için `BASLAT.cmd` dosyasına çift tıklayabilirsiniz.

PowerShell'i proje klasöründe açın:

```powershell
node -v
npm.cmd -v
npm.cmd install
npm.cmd run diagnose:foundry
npm.cmd run ingest
npm.cmd test
npm.cmd run diagnose
npm.cmd start
```

Beklenen temel doğrulamalar:

- `diagnose:foundry`: iki model diğer bilgileriyle birlikte bulunur.
- `ingest`: 17 belge, 30 pasaj, `qwen3-embedding-0.6b`, 1024 boyut.
- `diagnose`: 10/10 kontrol başarılı.
- Arayüz: `http://127.0.0.1:3000`

`KURULUM.cmd` aynı adımları sırayla çalıştırır ve sonunda sunucuyu başlatır.

## Komutlar

| Komut | Amaç |
|---|---|
| `npm run diagnose:foundry` | Foundry SDK, Windows çekirdeği ve model kataloğunu kontrol eder |
| `npm run ingest` | `docs/` belgelerini ayrıştırır, gerçek embeddingleri üretir ve `data/knowledge.db` dosyasını yazar |
| `npm test` | Birim, entegrasyon, retrieval, güvenlik, bütünlük ve HTTP testlerini çalıştırır |
| `npm run diagnose` | Node, belge, DB, embedding ve UI durumunu kontrol eder |
| `npm run live-eval` | Gerçek yerel modellerle isteğe bağlı kalite değerlendirmesi yapar |
| `npm start` | Yerel web uygulamasını başlatır |

## API

- `GET /api/health`
- `GET /api/stats`
- `GET /api/docs`
- `POST /api/chat`
- `POST /api/upload` (`.md` ve `.txt`, yerel)

Ayrıntılar için [API_REFERENCE.md](API_REFERENCE.md) dosyasına bakın.

## Kaynak bütünlüğü

Beş kanonik dosya `sources/original/` altındadır. `sources/manifest.json`, dosya adı, boyut ve SHA-256 değerlerini içerir. Orijinal dosyalar değiştirilmez; RAG katmanı `docs/` belgelerini kullanır. Kaynak çelişkisinde orijinal belge esas alınmalıdır.

## Sorun giderme

- Node sürümü aralık dışındaysa Node 22 LTS kurun.
- Native DLL hatasında projeyi senkronizasyon klasörü dışına taşıyın ve `npm install` komutunu yeniden çalıştırın.
- Bilgi tabanı boşsa `npm run ingest` çalıştırın.
- Model indirme sırasında ağ kesilirse komutu yeniden çalıştırın; Foundry önbellekteki tamamlanmış dosyaları kullanır.
- Ayrıntılı Windows notları: [SETUP_WINDOWS.md](SETUP_WINDOWS.md) ve [INSTALLATION_TROUBLESHOOTING.md](INSTALLATION_TROUBLESHOOTING.md).

## Doğrulama raporları

- [TEST_REPORT.md](TEST_REPORT.md)
- [QUALITY_REPORT.md](QUALITY_REPORT.md)
- [PERFORMANCE.md](PERFORMANCE.md)

## Lisans

MIT
