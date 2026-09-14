# Mimarî

## Akış

Kullanıcı sorusu
→ HTTP/UI
→ soru normalizasyonu
→ soru analizi
→ SQLite semantic retrieval
→ Foundry Local embedding
→ evidence seçimi
→ Foundry Local chat modeli
→ structured answer
→ evidence/claim validation
→ correction veya güvenli fallback

## Bileşenler

- `src/queryEngine.js`: uçtan uca soru işleme
- `src/sqliteStore.js`: SQLite saklama ve retrieval
- `src/foundryRuntime.js`: Foundry Local runtime sarmalayıcı
- `src/answerGuard.js`: claim ve sayı doğrulama
- `src/documentParser.js`: markdown belge ayrıştırma
- `src/ingest.js`: belge yükleme ve embedding üretimi
- `src/server.js`: HTTP API ve statik UI

## Veri önceliği

1. `sources/original/`
2. `sources/extracted/`
3. `docs/`

Kanonik kaynak ile çelişki varsa orijinal kaynak esas alınır.

## Güvenlik

- Harici API yok
- Prompt injection sınırlaması
- Türkçe normalizasyon
- Boş/aşırı uzun/geçersiz istek reddi
- Path traversal koruması
- HTML escape
