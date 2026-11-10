@echo off
setlocal EnableExtensions
cd /d "%~dp0"
chcp 65001 >nul
title 测网速
set "LOG=%~dp0启动日志.txt"

echo ========================================
echo   测网速 - 一键启动
echo ========================================
echo 目录: %CD%
echo.

echo 启动日志 %DATE% %TIME% > "%LOG%"
echo DIR=%CD%>> "%LOG%"

set "PORT=4177"
set "URL=http://127.0.0.1:4177"
set "NODE_EXE="

where node >nul 2>nul
if %ERRORLEVEL%==0 (
  for /f "delims=" %%i in ('where node') do (
    set "NODE_EXE=%%i"
    goto :have_node
  )
)

if exist "%~dp0.runtime\node.exe" (
  set "NODE_EXE=%~dp0.runtime\node.exe"
  set "PATH=%~dp0.runtime;%PATH%"
  goto :have_node
)

echo [提示] 未找到 Node，尝试下载便携版...
echo downloading portable node>> "%LOG%"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\ensure-portable-node.ps1" >> "%LOG%" 2>&1
if exist "%~dp0.runtime\node.exe" (
  set "NODE_EXE=%~dp0.runtime\node.exe"
  set "PATH=%~dp0.runtime;%PATH%"
  goto :have_node
)

echo.
echo [失败] 本机没有 Node.js，自动下载也失败了。
echo 1^) 打开 https://nodejs.org/ 安装 LTS
echo 2^) 勾选 Add to PATH
echo 3^) 关掉所有黑窗口后，再双击本文件
echo 或者先双击「最简启动.bat / run-simple.bat」看具体报错
echo 详见 启动日志.txt
echo.
type "%LOG%"
pause
exit /b 1

:have_node
echo [OK] 使用 Node: %NODE_EXE%
echo NODE=%NODE_EXE%>> "%LOG%"
"%NODE_EXE%" -v
"%NODE_EXE%" -v >> "%LOG%" 2>&1
echo.

if not exist "%~dp0server\index.js" (
  echo [失败] 缺少 server\index.js。你可能没有解压完整的 speedtest 文件夹。
  echo missing server>> "%LOG%"
  pause
  exit /b 1
)

if not exist "%~dp0node_modules\express" (
  echo [..] 首次安装依赖 npm install ...
  echo npm install>> "%LOG%"
  where npm >nul 2>nul
  if %ERRORLEVEL%==0 (
    call npm install --registry=https://registry.npmmirror.com >> "%LOG%" 2>&1
  ) else if exist "%~dp0.runtime\npm.cmd" (
    call "%~dp0.runtime\npm.cmd" install --registry=https://registry.npmmirror.com >> "%LOG%" 2>&1
  ) else (
    echo [失败] 找不到 npm
    echo missing npm>> "%LOG%"
    pause
    exit /b 1
  )
  if errorlevel 1 (
    echo [失败] npm install 失败，请打开 启动日志.txt 查看。
    notepad "%LOG%"
    pause
    exit /b 1
  )
)

REM 已在跑则直接打开
"%NODE_EXE%" -e "fetch('http://127.0.0.1:4177/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" >nul 2>nul
if %ERRORLEVEL%==0 (
  echo [OK] 服务已在运行，打开浏览器...
  start "" "%URL%"
  pause
  exit /b 0
)

echo [..] 启动本地服务...
echo starting server>> "%LOG%"

REM 关键修复：用 start /D 设置工作目录，避免引号嵌套导致闪退
start "cewangsu-server" /D "%~dp0" /MIN "%NODE_EXE%" "server\index.js"

set /a _tries=0
:wait_loop
set /a _tries+=1
"%NODE_EXE%" -e "fetch('http://127.0.0.1:4177/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" >nul 2>nul
if %ERRORLEVEL%==0 goto :ok
if %_tries% GEQ 40 goto :fail
timeout /t 1 /nobreak >nul
goto :wait_loop

:ok
echo [OK] 已启动，打开浏览器 %URL%
echo ready>> "%LOG%"
start "" "%URL%"
echo.
echo 若浏览器空白，请手动输入: %URL%
echo 停止服务：双击 停止测网速.bat
echo 仍失败：双击 诊断.bat 或 最简启动.bat
echo.
pause
exit /b 0

:fail
echo [失败] 服务没有在 40 秒内起来。
echo 请立刻改用「最简启动.bat」，看黑窗口里的报错。
echo timeout>> "%LOG%"
notepad "%LOG%"
pause
exit /b 1
