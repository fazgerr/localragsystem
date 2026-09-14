# Kalite Raporu — v4.0.6

**Doğrulama tarihi:** 22 Ağustos 2026  
**Durum:** Kabul kriterleri için doğrulandı; “üretim hazır” veya ölçülmemiş doğruluk/performans yüzdesi iddiası yoktur.

## Finalde giderilen sorunlar

- ZIP içindeki `Staj Formu Güncel.docx` dosya adı UTF-8 olarak düzeltildi; içerik hash'i değişmedi.
- `package.json`, kilit dosyası ve kurulum belgeleri `>=22.13.0 <24` aralığında birleştirildi.
- `diagnose`, Node 24 ve üzerini artık yanlışlıkla geçerli saymıyor.
- Foundry çalışma verisi için kullanıcıya özel, yazılabilir `appDataDir` tanımlandı ve `FOUNDRY_APP_DATA_DIR` ile değiştirilebilir hale getirildi.
- Uzun tek cümleli model cevaplarında kelime sınırının aşılması düzeltildi.
- Küçük yerel model açık kanıta rağmen `BILGI_YOK` döndürürse güçlü doğrudan kaynak özetinin kullanılabilmesi sağlandı.
- Genel sayım sorularında yazıyla verilen sayı içeren kaynak cümleleri, belirli ders-süre eşleşmelerini bozmadan öne çıkarıldı.
- Kaynakta bulunmayan maaş/ücret/TL soruları model çağrısından önce güvenli biçimde durduruldu.
- Modelin “Kullanıcı Talimat/Kanıtlar” gibi prompt çerçevesini cevaba sızdırması engellendi.
- Hatalı veya uydurma API/performans örnekleri ve ölçülmemiş yüzdeler belgelerden çıkarıldı.

## Doğrulanan özellikler

- 5/5 kanonik kaynak SHA-256 manifestiyle eşleşiyor.
- 17 belge, 30 pasaj ve 1024 boyutlu gerçek embedding içeren SQLite DB mevcut.
- Foundry Local SDK 1.2.0, WinML çekirdeği ve iki model kataloğu doğrulandı.
- Birim, entegrasyon, retrieval, answer guard, SQLite, ingestion, HTTP ve kaynak bütünlüğü testleri geçiyor.
- Kritik mezuniyet/staj sayısı sorusu gerçek model çalışmasında kaynaklı extractive fallback ile yanıtlandı.
- Kaynakta olmayan 2027 tarihi, stajyer maaşı/TL, talimat enjeksiyonu ve kapsam dışı hava sorusu güvenli davrandı.

## Bilinen sınırlar

- `qwen2.5-0.5b` küçük bir modeldir; deterministik kanıt denetimi ve extractive fallback sistemin zorunlu parçalarıdır.
- `node:sqlite`, Node 22'de deneysel uyarı gösterebilir.
- Model önbellekleri ve `node_modules` teslim ZIP'ine dahil değildir; ilk kurulum internet gerektirir.
- Canlı değerlendirme sonuçları donanıma ve yerel model sürümüne bağlıdır; final pakette ölçülmemiş doğruluk yüzdesi sunulmaz.
