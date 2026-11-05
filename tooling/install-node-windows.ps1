param(
  [Parameter(Mandatory = $true)]
  [string]$InstallRoot
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

function Get-NodeArchitecture {
  $reported = if ($env:PROCESSOR_ARCHITEW6432) {
    $env:PROCESSOR_ARCHITEW6432
  } else {
    $env:PROCESSOR_ARCHITECTURE
  }
  switch ($reported.ToUpperInvariant()) {
    'AMD64' { return 'x64' }
    'ARM64' { return 'arm64' }
    default { throw 'Este computador precisa de Windows 64 bits (x64 ou ARM64).' }
  }
}

$temporary = Join-Path ([IO.Path]::GetTempPath()) ("sl-campo-node-" + [guid]::NewGuid())
try {
  $architecture = Get-NodeArchitecture
  Write-Host 'Baixando o Node.js 24 oficial para uso exclusivo do SL Campo...'
  $releases = Invoke-RestMethod -Uri 'https://nodejs.org/dist/index.json' -UseBasicParsing
  $fileKind = "win-$architecture-zip"
  $release = $releases |
    Where-Object { $_.version -match '^v24\.[0-9]+\.[0-9]+$' -and $_.files -contains $fileKind } |
    Sort-Object { [version]$_.version.Substring(1) } -Descending |
    Select-Object -First 1
  if (-not $release) {
    throw "O site oficial nao apresentou uma versao Node.js 24 para Windows $architecture."
  }

  New-Item -ItemType Directory -Path $temporary -Force | Out-Null
  New-Item -ItemType Directory -Path $InstallRoot -Force | Out-Null
  $folderName = "node-$($release.version)-win-$architecture"
  $archiveName = "$folderName.zip"
  $archive = Join-Path $temporary $archiveName
  $checksums = Join-Path $temporary 'SHASUMS256.txt'
  $baseUrl = "https://nodejs.org/dist/$($release.version)"
  Invoke-WebRequest -Uri "$baseUrl/$archiveName" -OutFile $archive -UseBasicParsing
  Invoke-WebRequest -Uri "$baseUrl/SHASUMS256.txt" -OutFile $checksums -UseBasicParsing

  $pattern = '(?im)^([a-f0-9]{64})\s{2}' + [regex]::Escape($archiveName) + '$'
  $checksumMatch = [regex]::Match([IO.File]::ReadAllText($checksums), $pattern)
  if (-not $checksumMatch.Success) {
    throw 'Nao foi possivel localizar a assinatura oficial do arquivo baixado.'
  }
  $expected = $checksumMatch.Groups[1].Value.ToUpperInvariant()
  $actual = (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToUpperInvariant()
  if ($actual -ne $expected) {
    throw 'A verificacao de seguranca do Node.js falhou. O arquivo nao sera usado.'
  }

  $expanded = Join-Path $temporary 'expanded'
  Expand-Archive -LiteralPath $archive -DestinationPath $expanded -Force
  $source = Join-Path $expanded $folderName
  if (-not (Test-Path (Join-Path $source 'node.exe'))) {
    throw 'O pacote oficial do Node.js nao contem node.exe.'
  }

  $destination = Join-Path $InstallRoot 'node'
  $staging = Join-Path $InstallRoot ("node-new-" + [guid]::NewGuid())
  Move-Item -LiteralPath $source -Destination $staging
  if (Test-Path $destination) {
    Remove-Item -LiteralPath $destination -Recurse -Force
  }
  Move-Item -LiteralPath $staging -Destination $destination
  [IO.File]::WriteAllText((Join-Path $InstallRoot '.node-version'), $release.version)
  Write-Host "Node.js $($release.version) instalado dentro da pasta do SL Campo."
  exit 0
} catch {
  Write-Host ''
  Write-Host ('ERRO: ' + $_.Exception.Message) -ForegroundColor Red
  Write-Host 'Confira a internet e se a empresa permite acesso a nodejs.org.'
  exit 1
} finally {
  if (Test-Path $temporary) {
    Remove-Item -LiteralPath $temporary -Recurse -Force -ErrorAction SilentlyContinue
  }
}
