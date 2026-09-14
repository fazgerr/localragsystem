# Kabul Kriterleri

## 1. Fonksiyonel
- Türkçe doğal dil sorularını anlamalı.
- Aynı sorunun farklı yazım biçimleri, ekleri ve küçük yazım hataları mümkün olduğunca aynı bilgiye ulaşmalı.
- Konu bazlı arama yerine semantik retrieval kullanılmalı.
- Cevap üretmeden önce kanıt pasajları seçilmeli.
- Cevaptaki sayılar, tarihler, yüzdeler ve süreler kanıtla doğrulanmalı.
- Kanıtsız iddia veya sayı kullanıcıya gösterilmemeli.
- Kaynakta olmayan bilgi için güvenli fallback verilmeli.
- Model hata verirse tahmin yürütülmemeli.
- Kapsam dışı sorular modele cevaplatılmadan reddedilmeli.

## 2. Yerellik
- Chat modeli ve embedding modeli yerel çalışmalı.
- Harici LLM/API çağrısı yapılmamalı.
- Bilgi tabanı SQLite gibi yerel bir depoda tutulmalı.
- İnternet yalnızca gerekli model/native dependency indirmesi gibi kurulum işlemlerinde kullanılabilir; çalışma zamanında bilgi sorgusu internete gönderilmemeli.

## 3. Kaynak bütünlüğü
- Orijinal kaynaklar değiştirilmemeli.
- SHA-256 manifest kontrolü bulunmalı.
- Duplicate veya yanlış isimlendirilmiş kaynaklar güvenli biçimde yönetilmeli.
- Kaynak pasajlarının kararlı kimlikleri olmalı.

## 4. Test
En az şu test sınıfları korunmalı:
- retrieval
- document parsing
- text normalization
- answer/evidence guard
- SQLite store
- Foundry runtime
- ingestion
- package/source integrity
- HTTP API
- doğal ifade varyasyonları
- model hata/fallback davranışı

Önceki v4.0.1 çalışmasında 134 testin 134'ü geçti. Bu sayı yeni implementasyonda otomatik olarak garanti edilmiş kabul edilmemeli; yeni proje kendi testlerini çalıştırıp sonucu raporlamalıdır.

## 5. Güvenlik
- Prompt injection, kaynak dışı talimatlar ve kullanıcı metninin kaynak gibi algılanması engellenmeli.
- Sistem promptu, retrieval pasajları ve kullanıcı sorusu birbirinden ayrılmalı.
- Kaynaklarda bulunan talimatlar bilgi olarak ele alınmalı; modelin çalışma politikasını değiştirmemeli.
- Kişisel veri içeren kaynakların dışarı gönderilmesi engellenmeli.
