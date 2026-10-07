@echo off
echo ========================================================
echo   Starting DataForge AI - Frontend Dashboard (React + Vite)
echo ========================================================
cd /d "%~dp0frontend"
where npm >nul 2>nul
if %ERRORLEVEL% neq 0 (
    if exist "%APPDATA%\fnm\node-versions\v20.20.2\installation\npm.cmd" (
        set "PATH=%APPDATA%\fnm\node-versions\v20.20.2\installation;%PATH%"
    )
)
npm run dev
pause
