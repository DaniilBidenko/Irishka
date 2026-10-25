@echo off
chcp 65001 >nul
cd /d "C:\Users\Hello User\Desktop\irishka"
set WORKBOOK_DATA_DIR=C:\Users\Hello User\AppData\Local\WorkNotebook
call npm run app:stop
if errorlevel 1 pause
