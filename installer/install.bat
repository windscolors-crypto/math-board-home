@echo off
setlocal
rem Asks for the administrator password once, then runs the installer.
net session >nul 2>&1
if %errorlevel% neq 0 (
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)
powershell -NoProfile -STA -ExecutionPolicy Bypass -File "%~dp0installer\install.ps1"
echo.
pause
