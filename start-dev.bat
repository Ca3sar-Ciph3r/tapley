@echo off
cd /d "%~dp0"
echo Installing dependencies...
npm install
echo.
echo Starting dev server...
npm run dev
pause
