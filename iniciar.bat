@echo off
setlocal EnableExtensions DisableDelayedExpansion
title SL Campo - Iniciar
cd /d "%~dp0"
if errorlevel 1 goto pasta_invalida

echo.
echo ========================================
echo        SL CAMPO - Ambiente local
echo ========================================
echo.

if not exist "package.json" goto pasta_invalida
if not exist "package-lock.json" goto pasta_invalida
if not exist "tooling\install-node-windows.ps1" goto pasta_invalida

if exist ".runtime\node\node.exe" set "PATH=%CD%\.runtime\node;%PATH%"
where node.exe >nul 2>&1
if errorlevel 1 goto instalar_node
node -e "process.exit(Number(process.versions.node.split('.')[0]) >= 24 ? 0 : 1)"
if errorlevel 1 goto instalar_node
goto node_pronto

:instalar_node
echo Node.js 24 nao foi encontrado. A instalacao automatica sera iniciada.
echo Nada sera instalado no Windows: o Node ficara somente nesta pasta.
where powershell.exe >nul 2>&1
if errorlevel 1 goto powershell_ausente
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%CD%\tooling\install-node-windows.ps1" -InstallRoot "%CD%\.runtime"
if errorlevel 1 goto falha_node
set "PATH=%CD%\.runtime\node;%PATH%"
where node.exe >nul 2>&1
if errorlevel 1 goto falha_node
node -e "process.exit(Number(process.versions.node.split('.')[0]) >= 24 ? 0 : 1)"
if errorlevel 1 goto falha_node

:node_pronto
where npm.cmd >nul 2>&1
if errorlevel 1 goto npm_ausente
if exist ".env" goto dependencias
if not exist ".env.example" goto configuracao_ausente
node -e "const fs=require('node:fs'); const s=fs.readFileSync('.env.example','utf8'); if(!/^DEMO_MODE=true\r?$/m.test(s)) process.exit(1); fs.writeFileSync('.env',s.replace(/^DEMO_PASSWORD=.*$/m,'DEMO_PASSWORD=Campo-demo-2026!'),{flag:'wx'});"
if errorlevel 1 goto falha_configuracao
echo Configuracao demonstrativa criada em .env.
echo Login administrativo unico: admin@slcampo.local
echo Senha demonstrativa: Campo-demo-2026!
echo Use estas contas somente para demonstracao local.
echo Se o banco ja existe, suas senhas anteriores permanecem validas.
echo.

:dependencias
node -e "const fs=require('node:fs'),c=require('node:crypto'); try {const h=c.createHash('sha256').update(fs.readFileSync('package-lock.json')).digest('hex'); if(fs.readFileSync('node_modules/.sl-campo-lock','utf8')!==h || !fs.existsSync('node_modules/.bin/vite.cmd') || !fs.existsSync('node_modules/.bin/concurrently.cmd')) process.exit(1);} catch {process.exit(1);}"
if not errorlevel 1 goto iniciar
echo Instalando dependencias pelo package-lock.json...
echo A primeira instalacao requer acesso a internet.
if not exist ".runtime\npm-cache" mkdir ".runtime\npm-cache"
call npm.cmd ci --cache "%CD%\.runtime\npm-cache" --no-audit --no-fund
if errorlevel 1 goto falha_instalacao
node -e "const fs=require('node:fs'),c=require('node:crypto'); fs.writeFileSync('node_modules/.sl-campo-lock',c.createHash('sha256').update(fs.readFileSync('package-lock.json')).digest('hex'));"
if errorlevel 1 goto falha_instalacao

:iniciar
node tooling\windows-preflight.js
if errorlevel 43 goto portas_ocupadas
if errorlevel 42 goto ja_iniciado
if errorlevel 1 goto falha_verificacao
echo.
echo Iniciando a API e a interface do SL Campo...
echo O navegador sera aberto automaticamente quando o sistema estiver pronto.
echo No computador: http://localhost:5173/
echo No celular, conectado ao mesmo Wi-Fi, utilize um dos enderecos abaixo:
node -e "const os=require('node:os'); for(const rows of Object.values(os.networkInterfaces())) for(const ip of rows||[]) if(ip.family==='IPv4' && !ip.internal) console.log('  http://'+ip.address+':5173/');"
echo A atualizacao local e verificada automaticamente a cada 3 segundos.
echo A porta 5173 e fixa: nao sera trocada silenciosamente por outra porta.
echo Se o Windows perguntar, permita o acesso na rede privada.
echo Para PWA offline, camera e localizacao no celular, use HTTPS.
echo Mantenha esta janela aberta. Para encerrar, pressione Ctrl+C.
echo Sua configuracao .env e o banco .data serao preservados.
echo.
start "" /b powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%CD%\tooling\open-windows.ps1" -Url "http://localhost:5173/" >nul 2>&1
call npm.cmd run dev
if errorlevel 1 goto falha_inicio
endlocal
exit /b 0

:ja_iniciado
start "" "http://localhost:5173/"
endlocal
exit /b 0

:powershell_ausente
echo ERRO: o Windows PowerShell nao foi encontrado.
echo Solicite ao suporte de TI a habilitacao do PowerShell ou instale o Node.js 24 manualmente.
goto erro

:falha_node
echo ERRO: nao foi possivel preparar o Node.js automaticamente.
echo A empresa pode estar bloqueando downloads de nodejs.org.
echo Nesse caso, solicite ao suporte de TI a liberacao ou a instalacao do Node.js 24.
goto erro

:npm_ausente
echo ERRO: npm nao encontrado. Reinstale o Node.js com o npm e a opcao de PATH.
goto erro

:pasta_invalida
echo ERRO: execute este arquivo dentro da pasta completa do projeto SL Campo.
echo Os arquivos package.json e package-lock.json precisam estar presentes.
goto erro

:configuracao_ausente
echo ERRO: .env.example nao encontrado. Restaure o arquivo de configuracao de exemplo.
goto erro

:falha_configuracao
echo ERRO: nao foi possivel criar a configuracao demonstrativa.
echo Confira as permissoes da pasta e configure .env com base em .env.example.
goto erro

:falha_instalacao
echo ERRO: falha na instalacao. Confira a conexao e a mensagem do npm acima.
echo Execute iniciar.bat novamente depois de corrigir o problema.
goto erro

:falha_inicio
echo.
echo ERRO: o SL Campo foi encerrado com falha. Confira a mensagem acima.
echo Verifique a configuracao .env e se as portas ja estao ocupadas.
goto erro

:portas_ocupadas
echo ERRO: outro programa esta usando a porta 3001 ou 5173.
echo Feche a outra janela do SL Campo e tente novamente.
goto erro

:falha_verificacao
echo ERRO: nao foi possivel verificar as portas usadas pelo SL Campo.
goto erro

:erro
echo.
pause
endlocal
exit /b 1
