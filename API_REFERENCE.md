# Yerel API Referansı

Varsayılan adres: `http://127.0.0.1:3000`

Tüm uç noktalar yerel Node.js sunucusunda çalışır. İlk kurulum/model indirme haricinde harici servis çağrısı yapılmaz.

## GET /api/health

Hazırlık durumu, sürüm, modeller ve gerçek DB sayaçlarını döndürür.

```json
{
  "status": "ok",
  "message": "Çevrimdışı hazır",
  "phase": "ready",
  "version": "4.0.6",
  "chatModel": "qwen2.5-0.5b",
  "embeddingModel": "qwen3-embedding-0.6b",
  "retrieval": "Foundry Local embeddings + SQLite hybrid search",
  "documents": 17,
  "passages": 30
}
```

## POST /api/chat

```json
{
  "message": "IE 297 kaç iş günüdür?",
  "history": []
}
```

- `message`: zorunlu, boş olamaz, en fazla 1200 karakter.
- `history`: isteğe bağlı; sunucu son 8 kaydı kabul eder, işlem hattı en fazla son 2 kullanıcı turunu bağlam için kullanır.
- Sistem hazır değilse `503`, boş/uzun/geçersiz JSON için `400`, istek sınırında `429` döner.

Başarılı yanıtın temel alanları:

```json
{
  "text": "Kaynak doğrulamalı cevap",
  "grounded": true,
  "reason": "model-grounded",
  "sources": [],
  "cached": false,
  "responseTimeMs": 0
}
```

`reason`; `model-grounded`, `extractive-fallback`, `no-source`, `model-no-source`, `insufficient-evidence` veya `out-of-scope` olabilir.

## GET /api/docs

SQLite içindeki belgeleri ve pasaj sayılarını listeler.

## GET /api/stats

Süreç içi cache yapılandırmasını, bu çalışma oturumunda ölçülen sorgu sürelerini ve uptime değerini döndürür. Bunlar kalıcı benchmark değildir.

## POST /api/upload

Yerel `docs/` klasörüne `.md` veya `.txt` içerik ekler.

```json
{
  "filename": "ek_belge.md",
  "content": "# Başlık\n\nEn az 30 karakterlik içerik..."
}
```

- JSON gövdesi en fazla 2 MB'dır.
- Dosya adı güvenli hale getirilir; yalnızca `.md` ve `.txt` kabul edilir.
- Aynı dosya adı veya belge kimliği `409` ile reddedilir.
- Başarılı ekleme SQLite'a gerçek embedding yazar ve dosyayı `docs/` altında saklar.

## Güvenlik başlıkları

Yanıtlarda `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, `Cache-Control` ve Content Security Policy bulunur.
