@echo off
rem Просмотр базы данных в браузере (использует db/db_config.json)
cd /d "%~dp0"
python show_db.py %*
pause