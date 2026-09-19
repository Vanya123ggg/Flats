@echo off
rem Запуск сайта с авто-обновлением из базы данных
cd /d "%~dp0"
python server.py
pause