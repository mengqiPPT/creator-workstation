param(
  [int]$Port = 9333,
  [string]$OutputDir = ""
)

$ErrorActionPreference = "Stop"
if (-not $OutputDir) {
  $OutputDir = Join-Path $PSScriptRoot "..\qa-screenshots"
}
New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null

function Invoke-Cdp {
  param([string]$SocketUrl, [string]$Method, [hashtable]$Params = @{})
  $socket = [System.Net.WebSockets.ClientWebSocket]::new()
  $socket.ConnectAsync([Uri]$SocketUrl, [Threading.CancellationToken]::None).GetAwaiter().GetResult()
  try {
    $payload = [Text.Encoding]::UTF8.GetBytes((@{ id = 1; method = $Method; params = $Params } | ConvertTo-Json -Depth 12 -Compress))
    $socket.SendAsync([ArraySegment[byte]]::new($payload), [Net.WebSockets.WebSocketMessageType]::Text, $true, [Threading.CancellationToken]::None).GetAwaiter().GetResult()
    $deadline = [Threading.CancellationTokenSource]::new([TimeSpan]::FromSeconds(60))
    do {
      $buffer = New-Object byte[] 4194304
      $stream = [IO.MemoryStream]::new()
      do {
        $received = $socket.ReceiveAsync([ArraySegment[byte]]::new($buffer), $deadline.Token).GetAwaiter().GetResult()
        $stream.Write($buffer, 0, $received.Count)
      } while (-not $received.EndOfMessage)
      $message = [Text.Encoding]::UTF8.GetString($stream.ToArray()) | ConvertFrom-Json
    } while ($message.id -ne 1)
    return $message
  } finally {
    $socket.Dispose()
  }
}

$target = (Invoke-RestMethod "http://127.0.0.1:$Port/json")[0]
$socket = $target.webSocketDebuggerUrl
$ready = $false
for ($attempt = 0; $attempt -lt 30; $attempt++) {
  $probe = Invoke-Cdp $socket "Runtime.evaluate" @{ expression = "document.readyState === 'complete' && Boolean(document.querySelector('#main-content'))"; returnByValue = $true }
  if ($probe.result.result.value -eq $true) { $ready = $true; break }
  Start-Sleep -Milliseconds 300
}
if (-not $ready) { throw "Desktop app main view did not initialize within 9 seconds." }

$views = @("today", "goals", "studio", "analytics", "knowledge", "canvas", "ai")
$results = @()
foreach ($view in $views) {
  Invoke-Cdp $socket "Runtime.evaluate" @{ expression = "location.hash='$view'; window.dispatchEvent(new HashChangeEvent('hashchange'))" } | Out-Null
  $routeReady = $false
  for ($attempt = 0; $attempt -lt 20; $attempt++) {
    $routeProbe = Invoke-Cdp $socket "Runtime.evaluate" @{ expression = "location.hash === '#$view' && Boolean(document.querySelector('.app-shell.view-$view'))"; returnByValue = $true }
    if ($routeProbe.result.result.value -eq $true) { $routeReady = $true; break }
    Start-Sleep -Milliseconds 150
  }
  if (-not $routeReady) { throw "Desktop route did not match expected view: $view" }
  $audit = Invoke-Cdp $socket "Runtime.evaluate" @{
    expression = @"
JSON.stringify({
  title: document.title,
  hash: location.hash,
  heading: document.querySelector('main h1')?.textContent || '',
  errorBoundary: Boolean(document.querySelector('.error-boundary')),
  horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
  bodyTextLength: document.body.innerText.length,
  hasMain: Boolean(document.querySelector('#main-content'))
})
"@
    returnByValue = $true
  }
  $data = $audit.result.result.value | ConvertFrom-Json
  if ($view -ne "canvas") {
    $shot = Invoke-Cdp $socket "Page.captureScreenshot" @{ format = "png"; captureBeyondViewport = $false }
    [IO.File]::WriteAllBytes((Join-Path $OutputDir "$view.png"), [Convert]::FromBase64String($shot.result.data))
  }
  $results += [pscustomobject]@{ View=$view; Hash=$data.hash; Title=$data.title; Heading=$data.heading; Error=$data.errorBoundary; Overflow=$data.horizontalOverflow; Text=$data.bodyTextLength; Main=$data.hasMain }
}

$results | Format-Table -AutoSize
if ($results | Where-Object { $_.Hash -ne "#$($_.View)" -or $_.Error -or $_.Overflow -or -not $_.Main -or $_.Text -lt 80 }) { exit 1 }
