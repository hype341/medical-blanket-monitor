@echo off
setlocal

call "%~dp0deploy-server.cmd" %*
if errorlevel 1 exit /b %errorlevel%

call "%~dp0deploy-camera.cmd"
exit /b %errorlevel%
