@echo off
cd /d "%~dp0"
chcp 65001 >nul
title 测网速-诊断
set "LOG=%~dp0启动日志.txt"

echo 测网速诊断 > "%LOG%"
echo 时间: %DATE% %TIME%>> "%LOG%"
echo 目录: %CD%>> "%LOG%"
echo.>> "%LOG%"

echo ==== 目录内容 ====>> "%LOG%"
dir /b >> "%LOG%" 2>&1
echo.>> "%LOG%"

echo ==== 是否有关键文件 ====>> "%LOG%"
if exist "server\index.js" (echo server\index.js OK>> "%LOG%") else (echo MISSING server\index.js>> "%LOG%")
if exist "public\index.html" (echo public\index.html OK>> "%LOG%") else (echo MISSING public\index.html>> "%LOG%")
if exist "package.json" (echo package.json OK>> "%LOG%") else (echo MISSING package.json>> "%LOG%")
echo.>> "%LOG%"

echo ==== Node ====>> "%LOG%"
where node >> "%LOG%" 2>&1
node -v >> "%LOG%" 2>&1
where npm >> "%LOG%" 2>&1
npm -v >> "%LOG%" 2>&1
if exist ".runtime\node.exe" (echo portable node exists>> "%LOG%") else (echo no portable node>> "%LOG%")
echo.>> "%LOG%"

echo ==== 端口 4177 ====>> "%LOG%"
netstat -ano | findstr ":4177" >> "%LOG%" 2>&1
echo.>> "%LOG%"

echo ==== 试跑 node -e ====>> "%LOG%"
node -e "console.log('node-ok')" >> "%LOG%" 2>&1
echo.>> "%LOG%"

echo 诊断完成。
echo 已生成: %LOG%
echo 请把「启动日志.txt」发给我，或把内容复制过来。
echo.
notepad "%LOG%"
pause
