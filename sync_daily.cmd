@echo off
chcp 65001 >nul
cd /d "%~dp0"
set "PY="
if exist "%USERPROFILE%\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\python\python.exe" set "PY=%USERPROFILE%\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\python\python.exe"
if not defined PY for /f "delims=" %%i in ('where python 2^>nul') do if not defined PY set "PY=%%i"
if not defined PY if exist "C:\Python312\python.exe" set "PY=C:\Python312\python.exe"
if not defined PY if exist "%LOCALAPPDATA%\Programs\Python\Python312\python.exe" set "PY=%LOCALAPPDATA%\Programs\Python\Python312\python.exe"
if not defined PY (
  echo [ERROR] python not found at %DATE% %TIME%>> data\boot_error.log
  exit /b 1
)
echo [%DATE% %TIME%] using python: %PY%>> data\boot_error.log
"%PY%" sync_google.py >> data\sync_stdout.log 2>&1
