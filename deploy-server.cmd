@echo off
call "%~dp0deploy.cmd" %*
exit /b %errorlevel%
