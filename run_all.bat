@echo off
echo ========================================================
echo   Launching DataForge AI Full Stack Application
echo ========================================================
start "DataForge AI Backend" cmd /k "cd /d %~dp0 && run_backend.bat"
start "DataForge AI Frontend" cmd /k "cd /d %~dp0 && run_frontend.bat"
echo Services launched in separate windows.
