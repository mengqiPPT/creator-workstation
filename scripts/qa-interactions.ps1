param([int]$Port = 9333)
$ErrorActionPreference = "Stop"

function Invoke-Cdp {
  param([string]$SocketUrl, [string]$Method, [hashtable]$Params = @{})
  $socket = [System.Net.WebSockets.ClientWebSocket]::new()
  $socket.ConnectAsync([Uri]$SocketUrl, [Threading.CancellationToken]::None).GetAwaiter().GetResult()
  try {
    $payload = [Text.Encoding]::UTF8.GetBytes((@{ id = 1; method = $Method; params = $Params } | ConvertTo-Json -Depth 12 -Compress))
    $socket.SendAsync([ArraySegment[byte]]::new($payload), [Net.WebSockets.WebSocketMessageType]::Text, $true, [Threading.CancellationToken]::None).GetAwaiter().GetResult()
    $deadline = [Threading.CancellationTokenSource]::new([TimeSpan]::FromSeconds(15))
    do {
      $buffer = New-Object byte[] 4194304; $stream = [IO.MemoryStream]::new()
      do { $received = $socket.ReceiveAsync([ArraySegment[byte]]::new($buffer), $deadline.Token).GetAwaiter().GetResult(); $stream.Write($buffer,0,$received.Count) } while(-not $received.EndOfMessage)
      $message = [Text.Encoding]::UTF8.GetString($stream.ToArray()) | ConvertFrom-Json
    } while($message.id -ne 1)
    return $message
  } finally { $socket.Dispose() }
}

$socket = (Invoke-RestMethod "http://127.0.0.1:$Port/json")[0].webSocketDebuggerUrl
$expr = @"
(async () => {
  const output = {};
  const localResponse = await fetch('/api/vault/status');
  output.apiAuthorized = localResponse.ok;
  output.desktopBridge = Boolean(window.workstation?.saveMedia && window.workstation?.removeMedia && window.workstation?.chooseVaultFolder && window.workstation?.createDesktopShortcut);
  const beforeTasks = localStorage.getItem('workstation.tasks.v2');
  localStorage.setItem('workstation.tasks.v2', JSON.stringify([{id:'qa-persist',title:'restart-persistence-check',project:'QA',done:false,period:'today',createdAt:new Date().toISOString(),demo:false}]));
  localStorage.setItem('workstation.qa.marker','stable-origin-v040');
  output.saved = true;
  output.beforeTasks = beforeTasks;
  location.hash = 'canvas';
  return JSON.stringify(output);
})()
"@
$result = Invoke-Cdp $socket "Runtime.evaluate" @{ expression=$expr; awaitPromise=$true; returnByValue=$true }
if ($result.result.exceptionDetails) {
  $result | ConvertTo-Json -Depth 12 | Write-Output
  exit 1
}
if (-not $result.result.result.value) {
  $result | ConvertTo-Json -Depth 12 | Write-Output
  exit 1
}
$result.result.result.value | Write-Output
