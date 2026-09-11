@echo off
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-CimInstance Win32_Process -Filter \"Name = 'pythonw.exe'\" | Where-Object { $_.CommandLine -like '*reminder_service.py*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }"
