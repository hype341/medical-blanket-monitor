@echo off
setlocal

where pwsh.exe >nul 2>nul
if %errorlevel% equ 0 (
  pwsh.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0deploy\camera\deploy.ps1" %*
) else (
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0deploy\camera\deploy.ps1" %*
)

exit /b %errorlevel%
