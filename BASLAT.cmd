@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 goto :error
where npm.cmd >nul 2>nul
if errorlevel 1 goto :error
echo AGU IE Staj Asistani baslatiliyor...
call npm.cmd start
exit /b %errorlevel%
:error
echo Node.js veya npm bulunamadi. Once KURULUM.cmd dosyasini calistirin.
pause
exit /b 1
