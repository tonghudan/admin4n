@echo off
chcp 65001 >nul
title 停止测网速
echo 正在结束占用 4177 端口的进程...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":4177" ^| findstr "LISTENING"') do (
  echo 结束 PID %%a
  taskkill /F /PID %%a >nul 2>nul
)
echo 完成。若浏览器仍开着可直接关掉。
pause
