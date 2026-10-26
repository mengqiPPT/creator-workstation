$ErrorActionPreference = "Stop"
$workspace = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$runtimeRoot = Join-Path $env:TEMP "xiaohuang-workstation-runtime"
$version = (Get-Content -Raw -Encoding UTF8 (Join-Path $workspace "package.json") | ConvertFrom-Json).version
$outputRoot = Join-Path $workspace "release\小黄的工作站-$version-免安装版"
$builderOutput = Join-Path $workspace "release\win-unpacked"
$previousPortable = Get-ChildItem -LiteralPath (Join-Path $workspace "release") -Directory -Filter "小黄的工作站-*-免安装版" -ErrorAction SilentlyContinue |
  Where-Object { $_.FullName -ne $outputRoot } |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 1
$runtimeSource = if (Test-Path -LiteralPath $builderOutput) { $builderOutput } elseif ($previousPortable) { $previousPortable.FullName } else { $null }

if (Test-Path -LiteralPath $runtimeRoot) { Remove-Item -LiteralPath $runtimeRoot -Recurse -Force }
New-Item -ItemType Directory -Path $runtimeRoot -Force | Out-Null

if (Test-Path -LiteralPath $outputRoot) {
  Get-ChildItem -LiteralPath $outputRoot -Force | Where-Object { $_.Name -notin @("resources", "使用说明.txt") } |
    ForEach-Object { Copy-Item -LiteralPath $_.FullName -Destination $runtimeRoot -Recurse -Force }
  Copy-Item -LiteralPath (Join-Path $outputRoot "resources\app\node_modules") -Destination (Join-Path $runtimeRoot "node_modules") -Recurse -Force
} elseif ($runtimeSource) {
  Get-ChildItem -LiteralPath $runtimeSource -Force | Where-Object { $_.Name -ne "resources" } |
    ForEach-Object { Copy-Item -LiteralPath $_.FullName -Destination $runtimeRoot -Recurse -Force }
  $sourceModules = Join-Path $runtimeSource "resources\app\node_modules"
  if (-not (Test-Path -LiteralPath $sourceModules)) {
    throw "Electron 运行时缺少 node_modules，请先运行 npm run desktop:pack。"
  }
  Copy-Item -LiteralPath $sourceModules -Destination (Join-Path $runtimeRoot "node_modules") -Recurse -Force
} else {
  throw "没有找到 Electron 运行时，请先运行 npm run desktop:pack。"
}
if (Test-Path -LiteralPath $outputRoot) { Remove-Item -LiteralPath $outputRoot -Recurse -Force }
New-Item -ItemType Directory -Path $outputRoot -Force | Out-Null
Copy-Item -LiteralPath (Join-Path $runtimeRoot "小黄的工作站.exe") -Destination (Join-Path $outputRoot "小黄的工作站.exe")
Get-ChildItem -LiteralPath $runtimeRoot -Force | Where-Object { $_.Name -notin @("小黄的工作站.exe", "node_modules") } |
  ForEach-Object { Copy-Item -LiteralPath $_.FullName -Destination $outputRoot -Recurse -Force }

$appRoot = Join-Path $outputRoot "resources\app"
New-Item -ItemType Directory -Path $appRoot -Force | Out-Null
Copy-Item -Path (Join-Path $workspace "dist"),(Join-Path $workspace "electron"),(Join-Path $workspace "demo-vault"),(Join-Path $workspace "build") -Destination $appRoot -Recurse -Force
Copy-Item -Path (Join-Path $workspace "vite.config.ts"),(Join-Path $workspace "package.json") -Destination $appRoot -Force

$runtimeModules = Join-Path $runtimeRoot "node_modules"
Copy-Item -LiteralPath $runtimeModules -Destination $appRoot -Recurse -Force

@"
小黄的工作站 $version 免安装版

1. 双击“小黄的工作站.exe”即可使用。
2. 首次打开后，可在设置中创建桌面快捷方式。
3. 本机数据保存在 Windows 用户数据目录，升级免安装版不会清空。
4. 重要数据仍建议定期在设置中导出备份。
"@ | Set-Content -LiteralPath (Join-Path $outputRoot "使用说明.txt") -Encoding UTF8

$zipPath = Join-Path $workspace "点这里安装\小黄的工作站-$version-免安装版.zip"
if (Test-Path -LiteralPath $zipPath) { Remove-Item -LiteralPath $zipPath -Force }
Compress-Archive -LiteralPath $outputRoot -DestinationPath $zipPath -CompressionLevel Optimal
Write-Output $zipPath
