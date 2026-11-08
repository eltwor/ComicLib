@echo off
cd /d "%~dp0.."
set OPEN_BROWSER=1
call npm run app
pause
