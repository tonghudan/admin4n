@echo off
cd /d "%~dp0"
title cewangsu-fix-install
echo === fix install ===
echo DIR=%CD%
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] no node. Install https://nodejs.org/ LTS with Add to PATH
  pause
  exit /b 1
)

echo Stopping any old server on 4177...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":4177" ^| findstr "LISTENING"') do taskkill /F /PID %%a >nul 2>nul

echo Removing broken node_modules...
if exist node_modules rmdir /s /q node_modules
if exist package-lock.json del /f /q package-lock.json

echo Installing ONLY express (small)...
call npm install express@4.21.2 --omit=dev --registry=https://registry.npmjs.org
if errorlevel 1 (
  echo Official registry failed, trying npmmirror...
  call npm install express@4.21.2 --omit=dev --registry=https://registry.npmmirror.com
)
if errorlevel 1 (
  echo [ERROR] npm install still failed. Copy this window text to me.
  pause
  exit /b 1
)

echo.
echo Starting...
start "" "http://127.0.0.1:4177"
node server\index.js
echo.
pause
