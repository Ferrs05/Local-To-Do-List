@echo off
set "APP_DIR=%~dp0"
start "" /min pythonw "%APP_DIR%reminder_service.py"
timeout /t 1 /nobreak >nul
start "" "%APP_DIR%index.html"
