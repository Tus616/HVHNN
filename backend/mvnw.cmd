@echo off
setlocal
set "SCRIPT_DIR=%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%.mvn\wrapper\mvnw-bootstrap.ps1" %*
exit /b %ERRORLEVEL%
