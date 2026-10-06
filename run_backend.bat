@echo off
echo ========================================================
echo   Starting DataForge AI - Backend Service (FastAPI)
echo ========================================================
cd /d "%~dp0backend"
where uv >nul 2>nul
if %ERRORLEVEL% equ 0 (
    uv run uvicorn app.main:app --host 0.0.0.0 --port 8000
) else if exist "%~dp0.venv\Scripts\python.exe" (
    "%~dp0.venv\Scripts\python.exe" -m uvicorn app.main:app --host 0.0.0.0 --port 8000
) else (
    python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
)
pause
