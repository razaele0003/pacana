@echo off
cd /d "%~dp0"
if exist "desktop-output\Pacana-win32-x64\Pacana.exe" (
  start "" "desktop-output\Pacana-win32-x64\Pacana.exe"
) else (
  echo Build the desktop app first using npm run desktop:package.
  pause
)
