@echo off
rem Double-click: builds the signed Cafe Bazaar bundle and opens its folder.
cd /d "%~dp0"
call npx cap sync android || goto fail
call .\android\gradlew.bat -p android bundleRelease || goto fail
echo.
echo DONE: android\app\build\outputs\bundle\release\app-release.aab
explorer "%~dp0android\app\build\outputs\bundle\release"
pause
exit /b 0
:fail
echo.
echo BUILD FAILED - send the text above to Claude.
pause
exit /b 1
