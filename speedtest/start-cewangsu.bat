@echo off
cd /d "%~dp0"
if exist "%~dp0最简启动.bat" (
  call "%~dp0最简启动.bat"
) else if exist "%~dp0run-simple.bat" (
  call "%~dp0run-simple.bat"
) else (
  echo Missing launcher files in:
  echo %CD%
  pause
)
