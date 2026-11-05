@echo off
setlocal EnableExtensions DisableDelayedExpansion
title SL Campo - Atualizar
cd /d "%~dp0"
if errorlevel 1 goto erro
echo.
echo SL CAMPO - Atualizacao pelo GitHub
echo.
where git.exe >nul 2>&1
if errorlevel 1 goto sem_git
if not exist ".git" goto sem_repositorio
git rev-parse --is-inside-work-tree >nul 2>&1
if errorlevel 1 goto sem_repositorio
for /f "delims=" %%L in ('git status --porcelain') do goto alteracoes_locais
if exist ".runtime\node\node.exe" set "PATH=%CD%\.runtime\node;%PATH%"
where node.exe >nul 2>&1
if errorlevel 1 goto baixar
node -e "const s=require('node:net').connect(5173,'127.0.0.1'); s.setTimeout(700); s.on('connect',()=>process.exit(0)); s.on('error',()=>process.exit(1)); s.on('timeout',()=>process.exit(1));"
if not errorlevel 1 goto servidor_ativo
:baixar
echo Baixando a versao atual da branch main...
git pull --ff-only origin main
if errorlevel 1 goto falha_git
echo.
echo Codigo atualizado. Sua configuracao e o banco foram preservados.
call iniciar.bat
set "sl_result=%errorlevel%"
endlocal & exit /b %sl_result%
:servidor_ativo
echo Feche primeiro o SL Campo na janela do iniciar.bat usando Ctrl+C.
echo Depois execute atualizar.bat novamente.
goto erro
:alteracoes_locais
echo Existem alteracoes locais. Salve ou revise-as antes de atualizar.
echo Nada foi sobrescrito. O arquivo .env e o banco .data nao sao removidos.
goto erro
:sem_git
echo Instale o Git para Windows: https://git-scm.com/downloads/win
goto erro
:sem_repositorio
echo Este atualizador exige uma copia clonada com Git.
echo Se voce baixou um ZIP, baixe a versao nova do projeto e preserve .env e .data.
goto erro
:falha_git
echo Nao foi possivel atualizar. Confira a conexao e a mensagem do Git acima.
goto erro
:erro
echo.
pause
endlocal
exit /b 1
