# Kurulum ve Sorun Giderme

- **Node/npm bulunamıyor:** Node.js 22 LTS kurun, terminali kapatıp yeniden açın.
- **Node sürümü reddediliyor:** `node -v` değeri `>=22.13.0 <24` olmalıdır.
- **PowerShell npm.ps1 engeli:** `npm.cmd` kullanın veya kurum politikanıza uygun PowerShell ayarını sistem yöneticinizle doğrulayın.
- **Foundry native DLL bulunamıyor:** Projeyi OneDrive/SharePoint dışına taşıyın, `node_modules` klasörünü yeniden kurun ve `npm install` çalıştırın.
- **Visual C++/ONNX DLL yükleme hatası:** Güncel Visual C++ Redistributable kurun; rastgele DLL kopyalamayın.
- **Model kataloğu/indirme hatası:** İlk kurulumda internet erişimini doğrulayın ve komutu yeniden çalıştırın.
- **Bilgi tabanı boş:** `npm run ingest` çalıştırın; başarılı sonuç 17 belge ve 30 pasaj göstermelidir.
- **API 503 döndürüyor:** Başlangıç veya model yükleme tamamlanmamıştır; terminaldeki Foundry durumunu kontrol edin.
- **Yazma izni hatası:** Kullanıcıya ait normal bir klasör kullanın. Gerekirse Foundry çalışma dizinini `FOUNDRY_APP_DATA_DIR` ile yazılabilir bir konuma ayarlayın.

Kontrol sırası:

```powershell
npm install
npm run diagnose:foundry
npm run ingest
npm test
npm run diagnose
```
