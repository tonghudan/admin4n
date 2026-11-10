@echo off
chcp 65001 >nul
setlocal EnableExtensions
title 测网速
cd /d "%~dp0"

echo ========================================
echo   测网速 - 一键启动
echo ========================================
echo.

set "PORT=4177"
set "URL=http://127.0.0.1:%PORT%"
set "NODE_EXE="
set "NPM_CMD="

REM --- 1) 优先用系统 Node，其次用本目录便携运行时 ---
where node >nul 2>nul
if %ERRORLEVEL%==0 (
  for /f "delims=" %%i in ('where node') do (
    set "NODE_EXE=%%i"
    goto :node_found
  )
)

if exist "%~dp0.runtime\node.exe" (
  set "NODE_EXE=%~dp0.runtime\node.exe"
  set "PATH=%~dp0.runtime;%PATH%"
  goto :node_found
)

echo [提示] 未检测到 Node.js，正在尝试下载便携版（约 30MB，仅首次）...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\ensure-portable-node.ps1"
if exist "%~dp0.runtime\node.exe" (
  set "NODE_EXE=%~dp0.runtime\node.exe"
  set "PATH=%~dp0.runtime;%PATH%"
  goto :node_found
)

echo.
echo [失败] 无法自动准备 Node.js。
echo 请先安装 Node.js LTS： https://nodejs.org/
echo 安装时勾选 "Add to PATH"，然后重新双击本文件。
echo.
pause
exit /b 1

:node_found
echo [OK] Node: %NODE_EXE%
"%NODE_EXE%" -v
echo.

REM --- 2) 安装依赖 ---
if not exist "%~dp0node_modules\express" (
  echo [..] 首次运行，正在 npm install ...
  where npm >nul 2>nul
  if %ERRORLEVEL%==0 (
    call npm install --registry=https://registry.npmmirror.com
  ) else (
    REM 便携 Node 自带 npm.cmd
    if exist "%~dp0.runtime\npm.cmd" (
      call "%~dp0.runtime\npm.cmd" install --registry=https://registry.npmmirror.com
    ) else (
      echo [失败] 找不到 npm，请安装完整 Node.js LTS。
      pause
      exit /b 1
    )
  )
  if errorlevel 1 (
    echo [失败] npm install 失败。
    pause
    exit /b 1
  )
  echo.
)

REM --- 3) 若端口已被占用，直接打开浏览器 ---
powershell -NoProfile -Command "try { $r=Invoke-WebRequest -UseBasicParsing '%URL%/api/health' -TimeoutSec 2; if($r.StatusCode -eq 200){exit 0}else{exit 1} } catch { exit 1 }"
if %ERRORLEVEL%==0 (
  echo [OK] 服务已在运行，正在打开浏览器...
  start "" "%URL%"
  echo.
  echo 浏览器打不开时，请手动访问： %URL%
  echo 本窗口可关闭。
  pause
  exit /b 0
)

REM --- 4) 启动服务（新窗口），再打开浏览器 ---
echo [..] 正在启动本地服务 %URL%
start "测网速服务" /min cmd /c "cd /d "%~dp0" && "%NODE_EXE%" server\index.js"

set /a _tries=0
:wait_ready
set /a _tries+=1
powershell -NoProfile -Command "try { $r=Invoke-WebRequest -UseBasicParsing '%URL%/api/health' -TimeoutSec 1; if($r.StatusCode -eq 200){exit 0}else{exit 1} } catch { exit 1 }"
if %ERRORLEVEL%==0 goto :open_browser
if %_tries% GEQ 30 goto :start_failed
timeout /t 1 /nobreak >nul
goto :wait_ready

:open_browser
echo [OK] 服务已就绪，正在打开浏览器...
start "" "%URL%"
echo.
echo ----------------------------------------
echo  页面地址: %URL%
echo  关闭「测网速服务」窗口即停止测速。
echo  若浏览器空白，请确认杀毒软件未拦截。
echo ----------------------------------------
echo.
pause
exit /b 0

:start_failed
echo [失败] 等待服务启动超时。
echo 可手动执行: "%NODE_EXE%" server\index.js
echo 然后访问: %URL%
pause
exit /b 1
