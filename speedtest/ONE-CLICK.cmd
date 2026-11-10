@echo off
chcp 65001 >nul
cd /d "%~dp0"
title CeWangSu-ONE-CLICK
echo ========================================
echo   测网速 一键修复并启动
echo   目录: %CD%
echo ========================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [失败] 找不到 node。
  echo 请先安装 Node.js LTS: https://nodejs.org/
  echo 安装时勾选 Add to PATH，然后重新双击本文件。
  echo.
  pause
  exit /b 1
)

echo [1/4] Node 版本:
node -v
echo.

if not exist "server\index.js" (
  echo [失败] 当前目录不对，找不到 server\index.js
  echo 请把本文件放进 speedtest 文件夹后再双击。
  echo.
  dir /b
  echo.
  pause
  exit /b 1
)

echo [2/4] 清理旧的 node_modules ...
if exist "node_modules" (
  rmdir /s /q "node_modules" 2>nul
)
if exist "package-lock.json" del /f /q "package-lock.json" 2>nul
echo 清理完成。
echo.

echo [3/4] 安装 express（只装这一个包）...
call npm install express@4.21.2 --omit=dev --registry=https://registry.npmjs.org
if errorlevel 1 (
  echo 官方源失败，改试 npmmirror...
  call npm install express@4.21.2 --omit=dev --registry=https://registry.npmmirror.com
)
if errorlevel 1 (
  echo.
  echo [失败] npm 仍然失败。请把本窗口全部文字复制发给我。
  echo 也可把整个 speedtest 复制到 C:\cewangsu\speedtest 后再双击。
  echo.
  pause
  exit /b 1
)

echo.
echo [4/4] 启动服务...
echo 成功后浏览器打开: http://127.0.0.1:4177
echo 本窗口不要关。
echo.
start "" "http://127.0.0.1:4177"
node server\index.js

echo.
echo 服务已退出。若有报错请复制上面文字。
pause
