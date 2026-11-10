# 下载便携 Node.js 到 speedtest/.runtime （仅 Windows）
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$Runtime = Join-Path $Root ".runtime"
$Marker = Join-Path $Runtime "node.exe"
$Version = "v22.11.0"
$ZipName = "node-$Version-win-x64.zip"
$Url = "https://npmmirror.com/mirrors/node/$Version/$ZipName"
$Fallback = "https://nodejs.org/dist/$Version/$ZipName"
$TempZip = Join-Path $env:TEMP "cewangsu-$ZipName"

if (Test-Path $Marker) {
  Write-Host "便携 Node 已存在: $Marker"
  exit 0
}

New-Item -ItemType Directory -Force -Path $Runtime | Out-Null
Write-Host "下载: $Url"

function Get-NodeZip {
  param([string]$From)
  Invoke-WebRequest -Uri $From -OutFile $TempZip -UseBasicParsing
}

try {
  Get-NodeZip -From $Url
} catch {
  Write-Host "镜像失败，改用官网..."
  Get-NodeZip -From $Fallback
}

Write-Host "解压中..."
$ExtractTo = Join-Path $env:TEMP "cewangsu-node-extract"
if (Test-Path $ExtractTo) { Remove-Item -Recurse -Force $ExtractTo }
Expand-Archive -Path $TempZip -DestinationPath $ExtractTo -Force

$Inner = Get-ChildItem $ExtractTo | Where-Object { $_.PSIsContainer } | Select-Object -First 1
if (-not $Inner) { throw "解压后未找到 Node 目录" }

Copy-Item -Path (Join-Path $Inner.FullName "*") -Destination $Runtime -Recurse -Force
Remove-Item -Force $TempZip -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force $ExtractTo -ErrorAction SilentlyContinue

if (-not (Test-Path $Marker)) {
  throw "下载完成但未找到 node.exe"
}

Write-Host "便携 Node 就绪: $Marker"
