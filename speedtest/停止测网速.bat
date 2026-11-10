@echo off
cd /d "%~dp0"
echo Stopping process on port 4177...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":4177" ^| findstr "LISTENING"') do (
  echo kill PID %%a
  taskkill /F /PID %%a >nul 2>nul
)
echo Done.
pause
