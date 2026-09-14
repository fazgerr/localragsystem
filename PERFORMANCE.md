# Performans Notları — v4.0.6

## Doğrulanmış hızlı yol ölçümü

14 Eylül 2026 tarihindeki yerel doğrulamada, çalışma zamanı hazır durumdayken “IE 197, IE 297 ve IE 397 stajları ayrı ayrı kaç iş günüdür?” sorgusu doğrulanmış belge pasajlarından 17 ms'de yanıtlandı. Bu tek sorguya ait ölçümdür; farklı donanımlar, ilk model açılışı ve diğer sorular için gecikme garantisi değildir.

Bu dosya yalnızca koddan ve 22 Ağustos 2026 final doğrulamasından teyit edilen özellikleri içerir. Donanıma bağlı yanıt süresi, doğruluk oranı veya cache-hit oranı için ölçülmemiş yüzde verilmez.

## Uygulanan mekanizmalar

- Hibrit arama ağırlıkları: semantik `0.72`, sözcüksel `0.28`.
- Sorgu önbelleği: süreç belleğinde en fazla 100 kayıt, 1 saat TTL.
- İstek sınırı: istemci başına 60 sohbet isteği/dakika.
- `/api/stats`: tamamlanmış sorguların adet, ortalama, minimum ve maksimum sürelerini ve süreç çalışma süresini döndürür.
- Varsayılan sıralı model modu: embedding ve sohbet modellerini aynı anda bellekte tutmaktan kaçınır.
- Yanıt kaynaklarındaki skorlar iki ondalığa yuvarlanır ve gereksiz ayrıntılar API yanıtından çıkarılır.

## Sınırlar

- İlk model indirme süresi ağ hızına bağlıdır.
- İlk model yükleme ve çıkarım süresi CPU/GPU/NPU ve kullanılabilir belleğe bağlıdır.
- Sıralı model modu daha düşük bellek tüketimi karşılığında model geçiş süresini artırabilir.
- Kodda HTTP `Content-Encoding` sıkıştırması yoktur; “compression” ifadesi yalnızca JSON alanlarının sadeleştirilmesini anlatır.
- Yerel tek kullanıcılı uygulama için tasarlanmıştır; çok kullanıcılı yük testi yapılmamıştır.

## Ölçüm

Canlı sistemde anlık değerler:

```powershell
curl http://127.0.0.1:3000/api/stats
```

Bu uç noktanın değerleri çalışma oturumuna aittir ve kalıcı benchmark sonucu olarak yorumlanmamalıdır.
