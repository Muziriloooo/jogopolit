@echo off
if /I "%~1"=="--worker" goto trabalhador
setlocal EnableExtensions DisableDelayedExpansion
set "sl_worker=%TEMP%\sl-campo-atualizar-%RANDOM%-%RANDOM%.bat"
copy /y "%~f0" "%sl_worker%" >nul
if errorlevel 1 (
  echo ERRO: nao foi possivel preparar o atualizador temporario.
  pause
  endlocal & exit /b 1
)
call "%sl_worker%" --worker "%~dp0"
set "sl_result=%errorlevel%"
del /q "%sl_worker%" >nul 2>&1
endlocal & exit /b %sl_result%

:trabalhador
setlocal EnableExtensions DisableDelayedExpansion
title SL Campo - Atualizar
cd /d "%~2"
if errorlevel 1 goto pasta_invalida
echo.
echo SL CAMPO - Atualizacao pelo GitHub
echo.
if not exist "package.json" goto pasta_invalida
if exist ".runtime\node\node.exe" set "PATH=%CD%\.runtime\node;%PATH%"
where node.exe >nul 2>&1
if errorlevel 1 goto escolher_metodo
node -e "const s=require('node:net').connect(5173,'127.0.0.1'); s.setTimeout(700); s.on('connect',()=>process.exit(0)); s.on('error',()=>process.exit(1)); s.on('timeout',()=>process.exit(1));"
if not errorlevel 1 goto servidor_ativo

:escolher_metodo
if exist ".git" goto atualizar_git
goto atualizar_zip

:atualizar_git
where git.exe >nul 2>&1
if errorlevel 1 goto sem_git
git rev-parse --is-inside-work-tree >nul 2>&1
if errorlevel 1 goto atualizar_zip
for /f "delims=" %%L in ('git status --porcelain') do goto alteracoes_locais
echo Baixando a versao atual da branch main com Git...
git pull --ff-only origin main
if errorlevel 1 goto falha_git
goto atualizado

:atualizar_zip
where powershell.exe >nul 2>&1
if errorlevel 1 goto powershell_ausente
if not exist "tooling\update-windows.ps1" goto atualizador_ausente
echo Esta pasta veio de um ZIP. Baixando a versao atual sem apagar seus dados...
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%CD%\tooling\update-windows.ps1" -ProjectRoot "%CD%"
if errorlevel 1 goto falha_zip
goto atualizado

:atualizado
echo.
echo Codigo atualizado. A configuracao .env e o banco .data foram preservados.
call iniciar.bat
set "sl_result=%errorlevel%"
endlocal & exit /b %sl_result%

:servidor_ativo
echo Feche primeiro o SL Campo na janela do iniciar.bat usando Ctrl+C.
echo Depois execute atualizar.bat novamente.
goto erro
:alteracoes_locais
echo Existem alteracoes locais no repositorio Git. Nada foi sobrescrito.
echo Salve ou revise essas alteracoes antes de atualizar.
goto erro
:sem_git
echo Esta pasta possui um repositorio Git, mas o Git para Windows nao foi encontrado.
echo Instale o Git em https://git-scm.com/downloads/win ou use uma copia ZIP separada.
goto erro
:powershell_ausente
echo ERRO: o Windows PowerShell nao foi encontrado.
echo Solicite ao suporte de TI a habilitacao do PowerShell.
goto erro
:atualizador_ausente
echo ERRO: tooling\update-windows.ps1 nao foi encontrado.
echo Baixe atualizar-zip.bat, coloque-o nesta pasta e execute-o uma vez.
goto erro
:falha_git
echo Nao foi possivel atualizar com Git. Confira a conexao e a mensagem acima.
goto erro
:falha_zip
echo Nao foi possivel atualizar a copia ZIP. Nenhum dado da operacao foi apagado.
goto erro
:pasta_invalida
echo ERRO: execute este arquivo dentro da pasta completa do projeto SL Campo.
goto erro
:erro
echo.
pause
endlocal
exit /b 1
