# Windows Kurulum Rehberi

## Gereksinimler

- Windows x64
- Node.js 22 LTS: `>=22.13.0 <24`
- Güncel Visual C++ Redistributable
- İlk bağımlılık/model indirmeleri için internet

## Klasör

Projeyi OneDrive/SharePoint dışında normal bir yerel klasöre çıkarın:

```text
C:\Users\<kullanıcı>\AGU-Staj-Asistani
```

## Kurulum

```powershell
node -v
npm -v
npm install
npm run diagnose:foundry
npm run ingest
npm test
npm run diagnose
npm start
```

Arayüz: `http://127.0.0.1:3000`

`KURULUM.cmd` bu sırayı otomatik çalıştırır.

## Beklenen doğrulama

- Foundry kontrolü iki model adını göstermeli.
- Ingest 17 belge, 30 pasaj ve 1024 embedding boyutu göstermeli.
- Diagnose 10/10 olmalı.

Model önbelleği ZIP'e dahil değildir; modeller ilk kullanımda Foundry tarafından indirilir.
