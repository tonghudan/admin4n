@echo off
REM 最简模式：本窗口直接跑服务，黑窗口不要关
REM 出错时文字会停在屏幕上，方便把报错发给我

cd /d "%~dp0"
chcp 65001 >nul
title 测网速-最简启动
echo 当前目录: %CD%
echo.

where node >nul 2>nul
if errorlevel 1 (
  if exist "%CD%\.runtime\node.exe" (
    set "PATH=%CD%\.runtime;%PATH%"
  ) else (
    echo [错误] 找不到 node。
    echo 请先安装 Node.js LTS: https://nodejs.org/
    echo 安装时务必勾选 Add to PATH，装完重新打开本文件。
    echo.
    pause
    exit /b 1
  )
)

echo Node 版本:
node -v
echo.

if not exist "server\index.js" (
  echo [错误] 找不到 server\index.js
  echo 请确认你是在 speedtest 文件夹里运行，而不是只复制了某一个 bat。
  echo 当前目录: %CD%
  echo.
  pause
  exit /b 1
)

if not exist "node_modules\express" (
  echo 首次运行，正在安装依赖...
  call npm install --registry=https://registry.npmmirror.com
  if errorlevel 1 (
    echo [错误] npm install 失败。请把上面的红字错误发我。
    pause
    exit /b 1
  )
)

echo.
echo 正在启动，请稍等...
echo 启动成功后，用浏览器打开: http://127.0.0.1:4177
echo 本窗口必须保持打开。关掉就停止服务。
echo.
start "" "http://127.0.0.1:4177"
node server\index.js
echo.
echo 服务已退出。如果上面有红色报错，请截图发我。
pause
