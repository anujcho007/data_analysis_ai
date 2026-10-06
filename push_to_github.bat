@echo off
echo ========================================================
echo   Pushing DataForge AI to GitHub: anujcho007/data_analysis_ai
echo ========================================================
cd /d "%~dp0"
git branch -M main
git push -u origin main
echo.
echo ========================================================
if %ERRORLEVEL% equ 0 (
    echo   [SUCCESS] Code successfully pushed to GitHub!
) else (
    echo   [NOTICE] If asked, please complete browser sign-in.
)
echo ========================================================
pause
