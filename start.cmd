@echo off
chcp 65001 >nul
title Livestream Team Dashboard
cd /d "%~dp0"
where python >nul 2>nul
if errorlevel 1 (
  echo [!] python not found. Install Python 3 or edit this file.
  pause
  exit /b 1
)
echo Building data from Excel ...
python build_dashboard.py
echo.
echo Starting FULL board  http://127.0.0.1:8777/   (含财务)
start "board full" cmd /c python server.py --port 8777 --no-browser
echo Starting VJ board    http://127.0.0.1:8778/   (仅成绩，无财务)
start "board vj" cmd /c python server.py --port 8778 --no-browser --vj
timeout /t 3 >nul
start http://127.0.0.1:8777/
echo.
echo   Full : http://127.0.0.1:8777/
echo   VJ   : http://127.0.0.1:8778/
echo.
pause
