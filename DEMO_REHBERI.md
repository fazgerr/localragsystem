# 5 Dakikalık Demo Rehberi

## Problem (30 saniye)
AGÜ Endüstri Mühendisliği staj kuralları farklı belge ve formlarda bulunuyor. Öğrenci doğru bilgiye hızlı erişmekte zorlanabiliyor; genel amaçlı modeller ise kaynakta olmayan bir kural uydurabilir.

## Çözüm (45 saniye)
AGÜ IE Staj Asistanı, Abdullah Gül Üniversitesi Endüstri Mühendisliği Bölümünün staj belgelerini yerel SQLite bilgi tabanında arayan ve cevabı yalnızca bulunan kanıtlara dayanarak üreten çevrimdışı bir RAG uygulamasıdır. Soru ve belgeler dış servislere gönderilmez.

## Canlı demo (2 dakika)
Sırayla sor:

1. `Mezun olmadan önce kaç ayrı staj bitirmeliyim?`
2. `Staj başvurusu için hangi belgeler gerekiyor?`
3. `2027 staj başvurusu için son tarih nedir?`
4. `Bugün Kayseri'de hava nasıl?`

Beklenen davranış: İlk iki soru kaynaklı yanıt verir; üçüncü soruda tarih uydurmaz; dördüncü soruyu kapsam dışı sayar.

## Teknik fark (60 saniye)
- Microsoft Foundry Local ile yerel chat ve embedding modelleri
- Türkçe normalizasyon ve hibrit semantik/sözcüksel retrieval
- SQLite içinde 30 kanıt pasajı ve 1024 boyutlu vektörler
- Sayı, tarih, yüzde ve kritik iddialar için cevap koruması
- Model hatasında kaynak cümlelerinden güvenli fallback

## Kanıt ve kapanış (45 saniye)
`npm.cmd test` sonucunda 126/126 testin, `npm.cmd run diagnose` sonucunda 10/10 kontrolün geçtiğini göster. Son cümle: “Bu çalışma yalnızca cevap üreten bir chatbot değil; kaynak yoksa cevap vermemeyi bilen, tamamen yerel bir bilgi asistanıdır.”
