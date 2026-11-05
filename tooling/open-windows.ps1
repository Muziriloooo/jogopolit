param(
  [string]$Url = 'http://localhost:5173/'
)

$ProgressPreference = 'SilentlyContinue'
for ($attempt = 0; $attempt -lt 120; $attempt++) {
  try {
    $health = Invoke-RestMethod -Uri 'http://127.0.0.1:3001/api/health' -TimeoutSec 2 -UseBasicParsing
    if ($health.ok -eq $true) {
      $interface = Invoke-WebRequest -Uri 'http://127.0.0.1:5173/__sl/version' -TimeoutSec 2 -UseBasicParsing
      if ($interface.StatusCode -eq 200) {
        Start-Process $Url
        exit 0
      }
    }
  } catch {
    Start-Sleep -Seconds 1
  }
}
exit 1
