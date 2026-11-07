$ErrorActionPreference = "Stop"

$brokerAddress = "172.20.10.3"
$ports = @(80, 1883, 8083)

foreach ($port in $ports) {
  $firewallRule = if ($port -eq 80) {
    "Medical Blanket HTTP 80"
  } else {
    "Medical Blanket MQTT $port"
  }
  $existingProxy = netsh interface portproxy show v4tov4 |
    Select-String -Pattern "^0\.0\.0\.0\s+$port\s+$([regex]::Escape($brokerAddress))\s+$port\s*$"

  if (-not $existingProxy) {
    netsh interface portproxy add v4tov4 listenaddress=0.0.0.0 listenport=$port connectaddress=$brokerAddress connectport=$port
  }

  $existingRule = Get-NetFirewallRule -DisplayName $firewallRule -ErrorAction SilentlyContinue
  if (-not $existingRule) {
    New-NetFirewallRule `
      -DisplayName $firewallRule `
      -Direction Inbound `
      -Action Allow `
      -Protocol TCP `
      -LocalPort $port | Out-Null
  }
}

Write-Output "MQTT forwards ready: <Windows hotspot IP>:1883,8083 -> ${brokerAddress}:1883,8083"
