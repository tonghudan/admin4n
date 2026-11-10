@echo off
REM ASCII wrapper for consoles that mishandle Chinese filenames
cd /d "%~dp0"
if exist "%~dp0启动测网速.bat" (
  call "%~dp0启动测网速.bat"
) else (
  echo Missing launcher. Run: node server\index.js
  pause
)
