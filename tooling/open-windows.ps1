param(
  [string]$Url = 'http://localhost:5173/'
)

$ProgressPreference = 'SilentlyContinue'
for ($attempt = 0; $attempt -lt 120; $attempt++) {
  try {
    $health = Invoke-RestMethod -Uri 'http://127.0.0.1:5173/api/health' -TimeoutSec 2 -UseBasicParsing
    if ($health.ok -eq $true) {
      Start-Process $Url
      exit 0
    }
  } catch {
    Start-Sleep -Seconds 1
  }
}
exit 1
