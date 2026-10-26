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

$target = (Invoke-RestMethod "http://127.0.0.1:$Port/json")[0]
$expression = @"
(async () => {
  const response = await fetch('/api/ai/config', {method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({provider:'custom',providerName:'QA',baseUrl:'http://127.0.0.1:65530/v1',model:'qa-model',apiKey:'qa-secret-not-real'})});
  const body = await response.json();
  const statusResponse = await fetch('/api/ai/status');
  const stored = await statusResponse.json();
  return JSON.stringify({ok:response.ok && statusResponse.ok && stored.configured,status:response.status,body,stored});
})()
"@
$result = Invoke-Cdp $target.webSocketDebuggerUrl "Runtime.evaluate" @{ expression=$expression; awaitPromise=$true; returnByValue=$true }
$data = $result.result.result.value | ConvertFrom-Json
$data | ConvertTo-Json -Compress -Depth 8 | Write-Output
if (-not $data.ok) { exit 1 }
