@echo off
title NEON ROOM - TikTok LIVE
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Please install Node.js 22 or newer from https://nodejs.org
  pause
  exit /b 1
)
node -e "fetch('http://127.0.0.1:8080/api/state',{signal:AbortSignal.timeout(1500)}).then(r=>r.ok?r.json():Promise.reject()).then(s=>process.exit(s.version==='17.2'?0:2)).catch(()=>process.exit(1))"
if errorlevel 2 (
  echo A previous NEON ROOM server is still using port 8080.
  echo Close its server window, then run start.bat again to load this update.
  pause
  exit /b 1
)
if not errorlevel 1 (
  echo NEON ROOM is already running. Opening its control panel...
  start "" "http://127.0.0.1:8080/?control=1"
  if errorlevel 1 echo Open http://127.0.0.1:8080/?control=1 manually in your browser.
  exit /b 0
)
echo Starting NEON ROOM...
start "" /b powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 2; try { Start-Process 'http://127.0.0.1:8080/?control=1' -ErrorAction Stop } catch { Write-Host 'Open http://127.0.0.1:8080/?control=1 manually in your browser.' }"
node server.js
pause
