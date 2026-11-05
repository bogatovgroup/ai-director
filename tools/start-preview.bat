@echo off
rem Локальный просмотр сайта: http://127.0.0.1:8930/index.html
cd /d "%~dp0.."
echo Сайт доступен по адресу http://127.0.0.1:8930/index.html  (закрыть: Ctrl+C)
python -m http.server 8930 --bind 127.0.0.1
