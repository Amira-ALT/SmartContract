@echo off
setlocal
cd /d "%~dp0"
title SmartContract - run

rem Hardhat node port is fixed by hardhat.config.ts (localhost network).
set "RPC_PORT=8545"
if not defined UI_PORT set "UI_PORT=5180"

echo.
echo  ===  Billetterie NFT - demarrage  ===
echo.

echo [1/6] Recherche de Node.js 22.13+ ...
call :find_node
if not defined NODE_DIR goto :no_node
set "PATH=%NODE_DIR%;%PATH%"
for /f %%v in ('node -v') do echo       Node %%v - %NODE_DIR%

echo [2/6] Arret d'une instance precedente ...
call "%~dp0stop.bat" /quiet

echo [3/6] Dependances npm ...
if not exist "node_modules\@nomicfoundation\edr-win32-x64-msvc\" (
  call npm install
  if errorlevel 1 goto :fail
) else (
  echo       deja installees
)

if not exist logs mkdir logs

echo [4/6] Demarrage du noeud Hardhat sur le port %RPC_PORT% ...
start "SmartContract-Node" /min cmd /c "npx hardhat node > logs\node.log 2>&1"
node scripts\wait-rpc.mjs http://127.0.0.1:%RPC_PORT% 120
if errorlevel 1 goto :fail

echo [5/6] Compilation et deploiement des contrats ...
call npx hardhat run scripts\deploy.ts --network localhost
if errorlevel 1 goto :fail

echo [6/6] Demarrage de l'interface sur le port %UI_PORT% ...
set "PORT=%UI_PORT%"
start "SmartContract-UI" /min cmd /c "node server.mjs > logs\ui.log 2>&1"
node scripts\wait-rpc.mjs http://127.0.0.1:%UI_PORT%/rpc 30
if errorlevel 1 goto :fail

start "" "http://localhost:%UI_PORT%"
echo.
echo  Interface : http://localhost:%UI_PORT%
echo  Noeud RPC : http://127.0.0.1:%RPC_PORT%   (chainId 31337)
echo  Logs      : %~dp0logs
echo  Arret     : stop.bat
echo.
exit /b 0

:no_node
echo.
echo ERREUR : Node.js 22.13 ou plus recent est requis par Hardhat 3.
echo Installez-le depuis https://nodejs.org ou definissez NODE_HOME vers son dossier.
pause
exit /b 1

:fail
echo.
echo ERREUR : le demarrage a echoue. Consultez le dossier logs\ puis lancez stop.bat.
pause
exit /b 1

rem ---------------------------------------------------------------------------
rem Finds a node.exe >= 22.13: NODE_HOME, PATH, then common install locations.
:find_node
set "NODE_DIR="
if defined NODE_HOME call :try_node "%NODE_HOME%"
for /f "delims=" %%p in ('where node 2^>nul') do if not defined NODE_DIR call :try_node "%%~dpp"
for /d %%t in ("C:\Tools*") do for /d %%d in ("%%~t\node-v*") do if not defined NODE_DIR call :try_node "%%~d"
if defined NVM_HOME for /d %%d in ("%NVM_HOME%\v*") do if not defined NODE_DIR call :try_node "%%~d"
for /d %%d in ("%APPDATA%\nvm\v*") do if not defined NODE_DIR call :try_node "%%~d"
if not defined NODE_DIR call :try_node "%ProgramFiles%\nodejs"
if not defined NODE_DIR call :try_node "%LOCALAPPDATA%\Programs\nodejs"
exit /b 0

:try_node
set "CAND=%~1"
if "%CAND:~-1%"=="\" set "CAND=%CAND:~0,-1%"
if not exist "%CAND%\node.exe" exit /b 0
"%CAND%\node.exe" -e "const [a,b]=process.versions.node.split('.').map(Number);process.exit(a>22||(a==22&&b>=13)?0:1)" >nul 2>&1
if errorlevel 1 exit /b 0
set "NODE_DIR=%CAND%"
exit /b 0
