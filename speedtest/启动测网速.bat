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
  echo Check "Add to PATH", then reopen this window.
  echo.
  goto END
)

echo [OK] node:
node -v
echo.

if not exist "server\index.js" (
  echo [ERROR] server\index.js missing.
  dir /b
  goto END
)

if not exist "node_modules\express" (
  echo [..] installing express only...
  call npm install express@4.21.2 --omit=dev --registry=https://registry.npmjs.org
  if errorlevel 1 call npm install express@4.21.2 --omit=dev --registry=https://registry.npmmirror.com
  if errorlevel 1 (
    echo [ERROR] npm failed. Try FIX-INSTALL.cmd
    goto END
  )
)

echo.
echo Starting server...
echo Open http://127.0.0.1:4177
echo Keep this window OPEN.
echo.
start "" "http://127.0.0.1:4177"
node server\index.js
echo.
echo Server exited.

:END
echo.
pause
