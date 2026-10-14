@echo off
setlocal
cd /d "%~dp0"
if not defined UI_PORT set "UI_PORT=5180"
set "QUIET="
if /i "%~1"=="/quiet" set "QUIET=1"
set "STOPPED="

rem Kill only node.exe processes listening on the project ports.
for %%p in (8545 %UI_PORT%) do (
  for /f "tokens=5" %%i in ('netstat -ano ^| findstr /r /c:":%%p  *[^ ]*  *LISTENING"') do (
    tasklist /fi "PID eq %%i" /fi "IMAGENAME eq node.exe" /nh 2>nul | findstr /i "node.exe" >nul && (
      taskkill /f /t /pid %%i >nul 2>&1
      set "STOPPED=1"
      if not defined QUIET echo Processus %%i arrete ^(port %%p^)
    )
  )
)

rem Close the minimized console windows opened by run.bat, if still around.
taskkill /f /t /fi "WINDOWTITLE eq SmartContract-Node*" >nul 2>&1
taskkill /f /t /fi "WINDOWTITLE eq SmartContract-UI*" >nul 2>&1

if defined QUIET exit /b 0
if defined STOPPED (echo Billetterie NFT arretee.) else (echo Aucune instance en cours.)
exit /b 0
