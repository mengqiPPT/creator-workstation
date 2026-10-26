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
  location.hash = 'canvas';
  await new Promise(resolve => setTimeout(resolve, 900));
  const input = document.querySelector('input[accept^="image/"]');
  if (!input) return JSON.stringify({ok:false, reason:'media-input-missing'});
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="#e5a82e"/><circle cx="32" cy="32" r="18" fill="#171a1d"/></svg>';
  const transfer = new DataTransfer();
  transfer.items.add(new File([svg], 'qa-media.svg', {type:'image/svg+xml'}));
  Object.defineProperty(input, 'files', {configurable:true, value:transfer.files});
  input.dispatchEvent(new Event('change', {bubbles:true}));
  await new Promise(resolve => setTimeout(resolve, 1300));
  const state = JSON.parse(localStorage.getItem('workstation.canvas.v1') || '{}');
  const media = (state.nodes || []).filter(node => node.data?.kind === 'media');
  const targetMedia = media.at(-1);
  const card = document.querySelector('.canvas-media-preview');
  let mediaResponse = null;
  if (targetMedia?.data?.mediaUrl) mediaResponse = await fetch(targetMedia.data.mediaUrl);
  const removed = targetMedia?.data?.mediaId
    ? await window.workstation.removeMedia(targetMedia.data.mediaId)
    : null;
  await new Promise(resolve => setTimeout(resolve, 250));
  const removedResponse = targetMedia?.data?.mediaUrl
    ? await fetch(targetMedia.data.mediaUrl + '?qa=' + Date.now(), {cache:'no-store'})
    : null;
  return JSON.stringify({
    ok:true,
    mediaCount:media.length,
    preview:Boolean(card),
    served:Boolean(mediaResponse?.ok),
    status:mediaResponse?.status || 0,
    removed:Boolean(removed?.ok),
    removedStatus:removedResponse?.status || 0,
  });
})()
"@
$result = Invoke-Cdp $target.webSocketDebuggerUrl "Runtime.evaluate" @{ expression=$expression; awaitPromise=$true; returnByValue=$true }
$data = $result.result.result.value | ConvertFrom-Json
$data | ConvertTo-Json -Compress | Write-Output
if (-not $data.ok -or $data.mediaCount -lt 1 -or -not $data.preview -or -not $data.served -or -not $data.removed -or $data.removedStatus -ne 404) { exit 1 }
