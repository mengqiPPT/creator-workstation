param([int]$Port = 9333)
$ErrorActionPreference = "Stop"

function Invoke-Cdp {
  param([string]$SocketUrl, [string]$Method, [hashtable]$Params = @{})
  $socket = [System.Net.WebSockets.ClientWebSocket]::new()
  $socket.ConnectAsync([Uri]$SocketUrl, [Threading.CancellationToken]::None).GetAwaiter().GetResult()
  try {
    $payload = [Text.Encoding]::UTF8.GetBytes((@{ id = 1; method = $Method; params = $Params } | ConvertTo-Json -Depth 12 -Compress))
    $socket.SendAsync([ArraySegment[byte]]::new($payload), [Net.WebSockets.WebSocketMessageType]::Text, $true, [Threading.CancellationToken]::None).GetAwaiter().GetResult()
    $deadline = [Threading.CancellationTokenSource]::new([TimeSpan]::FromSeconds(30))
    do {
      $buffer = New-Object byte[] 4194304; $stream = [IO.MemoryStream]::new()
      do { $received = $socket.ReceiveAsync([ArraySegment[byte]]::new($buffer), $deadline.Token).GetAwaiter().GetResult(); $stream.Write($buffer,0,$received.Count) } while(-not $received.EndOfMessage)
      $message = [Text.Encoding]::UTF8.GetString($stream.ToArray()) | ConvertFrom-Json
    } while($message.id -ne 1)
    return $message
  } finally { $socket.Dispose() }
}

$deadline = (Get-Date).AddSeconds(45)
do {
  Start-Sleep -Milliseconds 500
  try { $target = (Invoke-RestMethod "http://127.0.0.1:$Port/json")[0] } catch { $target = $null }
} while (-not $target -and (Get-Date) -lt $deadline)
if (-not $target) { throw "Application did not restart" }

$expression = @"
JSON.stringify({
  origin: location.origin,
  hash: location.hash,
  marker: localStorage.getItem('workstation.qa.marker'),
  tasks: JSON.parse(localStorage.getItem('workstation.tasks.v2') || '[]').map(task => task.id),
  errorBoundary: Boolean(document.querySelector('.error-boundary')),
  ready: Boolean(document.querySelector('#main-content'))
})
"@
$renderDeadline = (Get-Date).AddSeconds(20)
do {
  $result = Invoke-Cdp $target.webSocketDebuggerUrl "Runtime.evaluate" @{ expression=$expression; returnByValue=$true }
  $data = $result.result.result.value | ConvertFrom-Json
  if (-not $data.ready) { Start-Sleep -Milliseconds 350 }
} while (-not $data.ready -and (Get-Date) -lt $renderDeadline)
$data | ConvertTo-Json -Compress | Write-Output
if ($data.origin -ne "http://127.0.0.1:17431" -or $data.marker -ne "stable-origin-v040" -or $data.tasks -notcontains "qa-persist" -or $data.errorBoundary -or -not $data.ready) { exit 1 }
