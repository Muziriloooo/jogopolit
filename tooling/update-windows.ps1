param(
  [Parameter(Mandatory = $true)]
  [string]$ProjectRoot
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

function Test-LocalPort {
  param([int]$Port)
  $client = New-Object Net.Sockets.TcpClient
  try {
    $attempt = $client.BeginConnect('127.0.0.1', $Port, $null, $null)
    if (-not $attempt.AsyncWaitHandle.WaitOne(700)) { return $false }
    try {
      $client.EndConnect($attempt)
      return $client.Connected
    } catch {
      return $false
    }
  } finally {
    $client.Dispose()
  }
}

$temporary = Join-Path ([IO.Path]::GetTempPath()) ("sl-campo-update-" + [guid]::NewGuid())
try {
  $ProjectRoot = [IO.Path]::GetFullPath($ProjectRoot)
  if (-not (Test-Path -LiteralPath (Join-Path $ProjectRoot 'package.json'))) {
    throw 'Execute o atualizador dentro da pasta completa do SL Campo.'
  }
  if (Test-LocalPort -Port 5173) {
    throw 'O SL Campo ainda esta aberto. Feche a janela do iniciar.bat com Ctrl+C e tente novamente.'
  }

  New-Item -ItemType Directory -Path $temporary -Force | Out-Null
  $archive = Join-Path $temporary 'sl-campo-main.zip'
  $expanded = Join-Path $temporary 'expanded'
  Write-Host 'Baixando a versao mais recente do SL Campo no GitHub...'
  Invoke-WebRequest `
    -Uri 'https://github.com/Muziriloooo/jogopolit/archive/refs/heads/main.zip' `
    -OutFile $archive `
    -UseBasicParsing
  if ((Get-Item -LiteralPath $archive).Length -lt 10000) {
    throw 'O arquivo recebido do GitHub esta incompleto.'
  }
  Expand-Archive -LiteralPath $archive -DestinationPath $expanded -Force
  $source = Get-ChildItem -LiteralPath $expanded -Directory |
    Where-Object { Test-Path -LiteralPath (Join-Path $_.FullName 'package.json') } |
    Select-Object -First 1
  if (-not $source) { throw 'O pacote baixado nao contem o projeto.' }
  $manifest = Get-Content -LiteralPath (Join-Path $source.FullName 'package.json') -Raw |
    ConvertFrom-Json
  if ($manifest.name -ne 'sl-campo' -or
      -not (Test-Path -LiteralPath (Join-Path $source.FullName 'server\app.js')) -or
      -not (Test-Path -LiteralPath (Join-Path $source.FullName 'src\main.tsx'))) {
    throw 'A verificacao do pacote baixado falhou. Os arquivos atuais foram preservados.'
  }

  Write-Host 'Aplicando os arquivos novos e preservando .env, .data, Node e dependencias...'
  & robocopy.exe $source.FullName $ProjectRoot /E /R:2 /W:1 `
    /XD '.git' '.data' '.runtime' 'node_modules' 'test-results' `
    /XF '.env' 'atualizar-zip.bat' `
    /NFL /NDL /NJH /NJS /NP
  $copyResult = $LASTEXITCODE
  if ($copyResult -ge 8) {
    throw "O Windows nao conseguiu copiar todos os arquivos (codigo $copyResult)."
  }
  if (-not (Test-Path -LiteralPath (Join-Path $ProjectRoot 'tooling\update-windows.ps1'))) {
    throw 'A atualizacao nao foi concluida. Execute o arquivo novamente.'
  }
  Write-Host 'Atualizacao por ZIP concluida com seguranca.' -ForegroundColor Green
  exit 0
} catch {
  Write-Host ''
  Write-Host ('ERRO: ' + $_.Exception.Message) -ForegroundColor Red
  Write-Host 'A configuracao .env e o banco .data nao foram removidos.'
  exit 1
} finally {
  if (Test-Path -LiteralPath $temporary) {
    Remove-Item -LiteralPath $temporary -Recurse -Force -ErrorAction SilentlyContinue
  }
}
