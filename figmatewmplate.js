
$fileKey = "ABC123"
$nodeId = "120:456"

$secureToken = Read-Host "Figma token" -AsSecureString
$token = [System.Net.NetworkCredential]::new(
  "", $secureToken
).Password

$headers = @{ "X-Figma-Token" = $token }

$url = "https://api.figma.com/v1/files/$fileKey/nodes?ids=$([uri]::EscapeDataString($nodeId))"

$response = Invoke-RestMethod -Uri $url -Headers $headers
$response | ConvertTo-Json -Depth 100 |
  Set-Content -Path ".\figma-design.json" -Encoding utf8

Remove-Variable token, headers
      