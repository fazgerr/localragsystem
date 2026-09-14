@echo off
setlocal
cd /d "%~dp0"
echo AGU IE Staj Asistani kurulum basliyor...
where node >nul 2>nul
if errorlevel 1 (echo Node.js bulunamadi. Node.js 22 LTS kurun.& goto :error)
where npm.cmd >nul 2>nul
if errorlevel 1 (echo npm bulunamadi.& goto :error)
node -v
if errorlevel 1 goto :error
node -e "const [major,minor]=process.versions.node.split('.').map(Number); process.exit(major===22 && minor>=13 ? 0 : 1)"
if errorlevel 1 (
  echo Bu proje Node.js 22.13 veya daha yeni bir Node.js 22 surumu gerektirir.
  goto :error
)
call npm.cmd -v
if errorlevel 1 goto :error
echo [1/5] Bagimliliklar ve Foundry kontrol ediliyor...
call npm.cmd config set registry=https://registry.npmjs.org/
if errorlevel 1 goto :error
call npm.cmd run install:foundry
if errorlevel 1 goto :error
echo [2/5] Bilgi tabani olusturuluyor...
call npm.cmd run ingest
if errorlevel 1 goto :error
echo [3/5] Testler calistiriliyor...
call npm.cmd test
if errorlevel 1 goto :error
echo [4/5] Tanilama calistiriliyor...
call npm.cmd run diagnose
if errorlevel 1 goto :error
echo [5/5] Sunucu baslatiliyor...
call npm.cmd start
exit /b %errorlevel%
:error
echo.
echo KURULUM TAMAMLANAMADI. Yukaridaki hata mesajini kontrol edin.
echo Yardim: INSTALLATION_TROUBLESHOOTING.md
pause
exit /b 1
