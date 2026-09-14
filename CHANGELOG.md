# Değişiklik Kaydı

## 4.0.6 — Çoklu staj süresi için hızlı kanıt yolu

- IE 197, IE 297 ve IE 397 sürelerini birlikte soran açık sorular, dil modelini beklemeden doğrulanmış belge pasajlarından yanıtlanır.
- Her süre ilgili ders koduyla açıkça eşleştirilir; belirsiz ve sırası anlaşılmayan cümleler engellenir.
- Yanıtlar statik bir hazır-cevap tablosundan değil, kaynak belgelerdeki kanıttan üretilmeye devam eder.
- Hazır durumdaki yerel çalışma ortamında doğrulanan örnek çoklu-süre sorgusu 17 ms'de tamamlanmıştır; bu değer donanıma ve ilk model açılışına bağlı genel bir gecikme garantisi değildir.
- Otomatik test sayısı 126'ya çıkarıldı.

## 4.0.5 — Hızlı ve doğru genel staj sayımı

- Doğal genel staj sayımı soruları için retrieval niyeti eklendi.
- Güçlü doğrudan kanıt bulunduğunda chat modelini beklemeden kaynak cümleleri döndürülüyor.
- Gerçek Foundry denemesinde ilgili sorgu 19 ms içinde doğru pasaj ve kaynakla yanıtlandı.
- Cevap tablosu veya hard-code cevap eklenmedi; sonuç seçilen yerel pasajdan çıkarılıyor.

## 4.0.4 — AGÜ IE kapsam markalaması

- Site, terminal çıktıları ve teslim belgeleri “AGÜ IE Staj Asistanı” adıyla birleştirildi.
- Kapsamın yalnızca Abdullah Gül Üniversitesi Endüstri Mühendisliği Bölümü staj süreçleri olduğu arayüzde açıkça belirtildi.
- Sunum ve final paket adlandırması bölüm kapsamıyla uyumlu hale getirildi.

## 4.0.3 — Teslim paketi iyileştirmeleri

- Windows betikleri PowerShell yürütme politikasından etkilenmemesi için `npm.cmd` kullanıyor.
- Kurulum hatasında pencere açık kalıyor ve anlaşılır yönlendirme gösteriyor.
- Sonraki kullanımlar için tek tıklamalı `BASLAT.cmd` eklendi.
- Model çıktısındaki HTML boşluk kodları temizleniyor.
- GitHub teslim ve 5 dakikalık demo rehberleri eklendi.

## 4.0.2 — Final doğrulama (22 Ağustos 2026)

- Kanonik Türkçe kaynak dosya adı düzeltildi; SHA-256 içerik bütünlüğü korundu.
- Node.js aralığı tüm paket ve kurulum belgelerinde `>=22.13.0 <24` olarak birleştirildi.
- Node üst sürüm denetimi ve Foundry yazılabilir çalışma dizini eklendi.
- Gerçek Foundry ingest ile 17 belge, 30 pasaj ve 1024 boyutlu SQLite embedding DB üretildi.
- Uzun cevap kelime sınırı, modelin yanlış `BILGI_YOK` davranışı ve genel sayım fallback'i düzeltildi.
- Kaynakta olmayan para soruları ve prompt çerçevesi sızıntıları için güvenlik kontrolleri/testleri eklendi.
- API, performans, kalite, kurulum ve test belgelerindeki doğrulanmamış iddialar temizlendi.
- Final test sonucu ve tanılama `TEST_REPORT.md` içinde kaydedildi.

Geçmiş sürümlere ait doğrulanmamış test, pasaj, doğruluk ve performans rakamları bu final kaydına taşınmamıştır.
