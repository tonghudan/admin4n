@echo off
cd /d "%~dp0"
set LOG=%~dp0startup-log.txt
echo cewangsu diagnose > "%LOG%"
echo TIME=%DATE% %TIME%>> "%LOG%"
echo DIR=%CD%>> "%LOG%"
echo.>> "%LOG%"
dir /b >> "%LOG%" 2>&1
echo.>> "%LOG%"
where node >> "%LOG%" 2>&1
node -v >> "%LOG%" 2>&1
npm -v >> "%LOG%" 2>&1
echo.>> "%LOG%"
if exist server\index.js (echo server OK>> "%LOG%") else (echo server MISSING>> "%LOG%")
if exist public\index.html (echo public OK>> "%LOG%") else (echo public MISSING>> "%LOG%")
if exist package.json (echo package OK>> "%LOG%") else (echo package MISSING>> "%LOG%")
echo Wrote %LOG%
notepad "%LOG%"
pause
