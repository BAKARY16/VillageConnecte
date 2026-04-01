param(
  [string]$BackendBaseUrl = "http://localhost:3001/api",
  [string]$BorneId = "B08",
  [string]$AdapterName = "",
  [int]$IntervalSec = 2,
  [string]$IngestToken = "",
  [switch]$OpenPortal,
  [string]$PortalUrl = "http://localhost:3002",
  [switch]$Once
)

$ErrorActionPreference = "Stop"

function Normalize-Mac([string]$Mac) {
  if ([string]::IsNullOrWhiteSpace($Mac)) { return $null }
  $clean = $Mac.Trim().ToUpper().Replace("-", ":")
  if ($clean -match "^([0-9A-F]{2}:){5}[0-9A-F]{2}$") { return $clean }
  return $null
}

function Get-Adapter {
  param([string]$Name)

  if (-not [string]::IsNullOrWhiteSpace($Name)) {
    $selected = Get-NetAdapter -Name $Name -ErrorAction Stop
    return $selected
  }

  $candidates = Get-NetAdapter |
    Where-Object { $_.Status -eq "Up" -and $_.MacAddress -and $_.HardwareInterface } |
    Sort-Object -Property InterfaceMetric

  if (-not $candidates) {
    throw "Aucune carte reseau active detectee."
  }

  return $candidates[0]
}

function Get-Ipv4ForAdapter {
  param([string]$Alias)
  $ip = Get-NetIPAddress -InterfaceAlias $Alias -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object { $_.IPAddress -and $_.IPAddress -ne "127.0.0.1" } |
    Select-Object -First 1
  if ($ip) { return $ip.IPAddress }
  return $null
}

function Push-Sample {
  param(
    [string]$Url,
    [string]$Token,
    [string]$Borne,
    [hashtable]$Sample
  )

  $headers = @{ "Content-Type" = "application/json" }
  if (-not [string]::IsNullOrWhiteSpace($Token)) {
    $headers["x-ingest-token"] = $Token
  }

  $body = @{
    borneId = $Borne
    source = "windows-local"
    samples = @($Sample)
  } | ConvertTo-Json -Depth 6

  return Invoke-RestMethod -Uri $Url -Method Post -Headers $headers -Body $body -ErrorAction Stop
}

$apiBase = $BackendBaseUrl.TrimEnd("/")
$ingestUrl = "$apiBase/captive/metrics/ingest"
$adapter = Get-Adapter -Name $AdapterName
$mac = Normalize-Mac $adapter.MacAddress
$ip = Get-Ipv4ForAdapter -Alias $adapter.Name

if (-not $mac) {
  throw "Impossible de lire la MAC de l'adaptateur '$($adapter.Name)'."
}

$borne = $BorneId.Trim().ToUpper()
$portalLink = "$($PortalUrl.TrimEnd('/'))/?mac=$mac&ip=$ip&borneId=$borne"

Write-Host ""
Write-Host "=== Collector Windows ==="
Write-Host "Adapter : $($adapter.Name)"
Write-Host "MAC     : $mac"
Write-Host "IP      : $ip"
Write-Host "Ingest  : $ingestUrl"
Write-Host "Borne   : $borne"
Write-Host "Portal  : $portalLink"
Write-Host ""

if ($OpenPortal) {
  Start-Process $portalLink | Out-Null
}

$prev = Get-NetAdapterStatistics -Name $adapter.Name
if (-not $prev) {
  throw "Impossible de lire les stats de l'adaptateur '$($adapter.Name)'."
}

while ($true) {
  Start-Sleep -Seconds $IntervalSec
  $cur = Get-NetAdapterStatistics -Name $adapter.Name

  $rxBytes = [double]$cur.ReceivedBytes
  $txBytes = [double]$cur.SentBytes
  $deltaRx = [math]::Max(0, $rxBytes - [double]$prev.ReceivedBytes)
  $deltaTx = [math]::Max(0, $txBytes - [double]$prev.SentBytes)

  $downMbps = [math]::Round(($deltaRx * 8) / ($IntervalSec * 1000000), 3)
  $upMbps = [math]::Round(($deltaTx * 8) / ($IntervalSec * 1000000), 3)

  $sample = @{
    mac = $mac
    ip = $ip
    rxBytes = [math]::Round($rxBytes)
    txBytes = [math]::Round($txBytes)
    rxDeltaBytes = [math]::Round($deltaRx)
    txDeltaBytes = [math]::Round($deltaTx)
    downMbps = $downMbps
    upMbps = $upMbps
  }

  try {
    $res = Push-Sample -Url $ingestUrl -Token $IngestToken -Borne $borne -Sample $sample
    Write-Host ("[{0}] RX={1} Mbps TX={2} Mbps | updated={3} ignored={4}" -f (Get-Date -Format "HH:mm:ss"), $downMbps, $upMbps, $res.updated, $res.ignored)
  } catch {
    Write-Host ("[{0}] ERREUR INGEST: {1}" -f (Get-Date -Format "HH:mm:ss"), $_.Exception.Message) -ForegroundColor Yellow
  }

  $prev = $cur
  if ($Once) { break }
}
