$ErrorActionPreference = "Stop"
$workspace = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$version = (Get-Content -Raw -Encoding UTF8 (Join-Path $workspace "package.json") | ConvertFrom-Json).version
$oldInstallers = Get-ChildItem -LiteralPath (Join-Path $workspace "点这里安装") -Filter "小黄的工作站-安装包-*.exe" -ErrorAction SilentlyContinue |
  Where-Object { $_.Name -ne "小黄的工作站-安装包-$version.exe" }

$checks = [ordered]@{
  FixedDesktopOrigin = (Select-String -Path (Join-Path $workspace "electron\main.mjs") -Pattern '17431' -Quiet)
  RandomPortRemoved = -not (Select-String -Path (Join-Path $workspace "electron\main.mjs") -Pattern 'listen\(0\)' -Quiet)
  ApiSessionToken = (Select-String -Path (Join-Path $workspace "electron\main.mjs") -Pattern 'X-Workstation-Token' -Quiet)
  SafeStorage = (Select-String -Path (Join-Path $workspace "vite.config.ts") -Pattern 'electron-safe-storage-v1' -Quiet)
  MediaInput = (Select-String -Path (Join-Path $workspace "src\CanvasWorkspace.tsx") -Pattern 'image/\*,video/\*,audio/\*' -Quiet)
  MediaCleanup = (Select-String -Path (Join-Path $workspace "src\CanvasWorkspace.tsx") -Pattern 'removeUnusedMedia\(deletedNodes' -Quiet) -and (Select-String -Path (Join-Path $workspace "electron\main.mjs") -Pattern 'workstation:remove-media' -Quiet)
  CanvasDrop = (Select-String -Path (Join-Path $workspace "src\CanvasWorkspace.tsx") -Pattern 'onDrop=' -Quiet)
  CanvasPaste = (Select-String -Path (Join-Path $workspace "src\CanvasWorkspace.tsx") -Pattern 'addEventListener\("paste"' -Quiet)
  ImportConfirmation = (Select-String -Path (Join-Path $workspace "src\CanvasWorkspace.tsx") -Pattern 'pendingImport' -Quiet)
  ImeGuard = (Select-String -Path (Join-Path $workspace "src\App.tsx") -Pattern 'isComposing' -Quiet)
  AiAbort = (Select-String -Path (Join-Path $workspace "src\App.tsx") -Pattern 'AbortController' -Quiet)
  NewChatConfirmation = (Select-String -Path (Join-Path $workspace "src\App.tsx") -Pattern 'aiNewChatOpen' -Quiet)
  BackupValidation = (Select-String -Path (Join-Path $workspace "src\localBackup.ts") -Pattern 'validateBackupItem' -Quiet)
  NoOldInstaller = $oldInstallers.Count -eq 0
  DeliveryZip = Test-Path -LiteralPath (Join-Path $workspace "点这里安装\小黄的工作站-$version-免安装版.zip")
}

$checks.GetEnumerator() | ForEach-Object { [pscustomobject]@{ Check=$_.Key; Passed=$_.Value } } | Format-Table -AutoSize
if ($checks.Values -contains $false) { exit 1 }
