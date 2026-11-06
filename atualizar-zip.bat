@echo off
setlocal EnableExtensions DisableDelayedExpansion
title SL Campo - Corrigir atualizador ZIP
cd /d "%~dp0"
if errorlevel 1 goto pasta_invalida
if not exist "package.json" goto pasta_invalida
where powershell.exe >nul 2>&1
if errorlevel 1 goto powershell_ausente
set "sl_script=%TEMP%\sl-campo-update-%RANDOM%-%RANDOM%.ps1"
echo.
echo Baixando o atualizador novo do SL Campo...
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -Command "$ProgressPreference='SilentlyContinue'; [Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -UseBasicParsing -Uri 'https://raw.githubusercontent.com/Muziriloooo/jogopolit/main/tooling/update-windows.ps1' -OutFile '%sl_script%'"
if errorlevel 1 goto falha_download
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%sl_script%" -ProjectRoot "%CD%"
set "sl_result=%errorlevel%"
del /q "%sl_script%" >nul 2>&1
if not "%sl_result%"=="0" goto falha_atualizacao
echo.
echo Atualizador corrigido e projeto atualizado. Iniciando o SL Campo...
call iniciar.bat
set "sl_result=%errorlevel%"
endlocal & exit /b %sl_result%

:falha_download
del /q "%sl_script%" >nul 2>&1
echo ERRO: nao foi possivel baixar o atualizador no GitHub.
echo Confira a internet ou solicite a liberacao de github.com ao suporte de TI.
goto erro
:falha_atualizacao
echo ERRO: a atualizacao nao foi concluida. Confira a mensagem acima.
goto erro
:powershell_ausente
echo ERRO: o Windows PowerShell nao foi encontrado.
goto erro
:pasta_invalida
echo ERRO: coloque este arquivo dentro da pasta completa do projeto SL Campo.
:erro
echo.
pause
endlocal
exit /b 1
