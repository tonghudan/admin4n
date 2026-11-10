@echo off
cd /d "%~dp0"
title cewangsu
echo ========================================
echo  CeWangSu launcher
echo  DIR: %CD%
echo ========================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] node.exe not found in PATH.
  echo Install Node.js LTS from https://nodejs.org/
  echo Check "Add to PATH", then close and reopen this window.
  echo.
  goto END
)

echo [OK] node:
node -v
echo.

if not exist "server\index.js" (
  echo [ERROR] server\index.js missing.
  echo Run this inside the speedtest folder.
  echo.
  dir /b
  echo.
  goto END
)

if not exist "node_modules\express" (
  echo [..] npm install first time, please wait...
  call npm install --registry=https://registry.npmmirror.com
  if errorlevel 1 (
    echo [ERROR] npm install failed. Read messages above.
    goto END
  )
)

echo.
echo Starting server...
echo When you see started, open: http://127.0.0.1:4177
echo Keep this window OPEN.
echo.
start "" "http://127.0.0.1:4177"
node server\index.js
echo.
echo Server exited. Copy any error text above.

:END
echo.
echo ---------- window kept open ----------
pause
