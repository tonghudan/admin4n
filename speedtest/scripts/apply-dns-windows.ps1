# 测网速 — Windows DNS 应用脚本（需管理员 PowerShell）
# 用法（以管理员打开 PowerShell）:
#   Set-ExecutionPolicy -Scope Process Bypass
#   .\apply-dns-windows.ps1 -Preset aliyun
#   .\apply-dns-windows.ps1 -Preset show
#   .\apply-dns-windows.ps1 -Preset restore
#
# 修改前会打印当前 DNS，并要求输入 yes 确认。

param(
  [Parameter(Mandatory = $true)]
  [string]$Preset,
  [string]$InterfaceAlias = ""
)

$ErrorActionPreference = "Stop"
$BackupDir = Join-Path $env:USERPROFILE ".cewangsu-dns-backup"
$BackupFile = Join-Path $BackupDir "windows-dns.json"

function Assert-Admin {
  $id = [Security.Principal.WindowsIdentity]::GetCurrent()
  $p = New-Object Security.Principal.WindowsPrincipal($id)
  if (-not $p.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host "请以管理员身份运行 PowerShell 后再执行本脚本。"
    exit 1
  }
}

function Get-PresetServers([string]$name) {
  switch ($name.ToLower()) {
    "aliyun" { return @("223.5.5.5", "223.6.6.6") }
    "dnspod" { return @("119.29.29.29", "182.254.116.116") }
    "tencent" { return @("119.29.29.29", "182.254.116.116") }
    "114" { return @("114.114.114.114", "114.114.115.115") }
    "baidu" { return @("180.76.76.76") }
    "cloudflare" { return @("1.1.1.1", "1.0.0.1") }
    "cf" { return @("1.1.1.1", "1.0.0.1") }
    "google" { return @("8.8.8.8", "8.8.4.4") }
    default { return $null }
  }
}

function Get-ActiveAlias {
  if ($InterfaceAlias) { return $InterfaceAlias }
  $route = Get-NetRoute -DestinationPrefix "0.0.0.0/0" |
    Sort-Object RouteMetric |
    Select-Object -First 1
  if ($null -eq $route) { throw "找不到默认路由网卡" }
  $if = Get-NetIPInterface -InterfaceIndex $route.InterfaceIndex -AddressFamily IPv4
  return $if.InterfaceAlias
}

function Show-Current([string]$alias) {
  Write-Host "=== 网卡: $alias ==="
  Get-DnsClientServerAddress -InterfaceAlias $alias -AddressFamily IPv4 |
    Format-List
  Write-Host "=== 默认网关 ==="
  Get-NetRoute -DestinationPrefix "0.0.0.0/0" |
    Sort-Object RouteMetric |
    Select-Object -First 1 |
    Format-List InterfaceAlias, NextHop, RouteMetric
}

if ($Preset -eq "show") {
  $alias = Get-ActiveAlias
  Show-Current $alias
  exit 0
}

Assert-Admin
New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null
$alias = Get-ActiveAlias

if ($Preset -eq "restore") {
  if (-not (Test-Path $BackupFile)) {
    Write-Host "找不到备份 $BackupFile"
    exit 1
  }
  $bak = Get-Content $BackupFile -Raw | ConvertFrom-Json
  Write-Host "将恢复网卡 [$($bak.Alias)] DNS -> $($bak.Servers -join ', ')"
  $confirm = Read-Host "确认？输入 yes"
  if ($confirm -ne "yes") { Write-Host "已取消"; exit 0 }
  if (-not $bak.Servers -or $bak.Servers.Count -eq 0) {
    Set-DnsClientServerAddress -InterfaceAlias $bak.Alias -ResetServerAddresses
  } else {
    Set-DnsClientServerAddress -InterfaceAlias $bak.Alias -ServerAddresses $bak.Servers
  }
  Show-Current $bak.Alias
  exit 0
}

$servers = Get-PresetServers $Preset
if ($null -eq $servers) {
  Write-Host "未知预设: $Preset （aliyun|dnspod|114|baidu|cloudflare|google|show|restore）"
  exit 1
}

Write-Host ">>> 修改前"
Show-Current $alias

$current = @(
  (Get-DnsClientServerAddress -InterfaceAlias $alias -AddressFamily IPv4).ServerAddresses
)
@{
  Alias = $alias
  Servers = $current
  SavedAt = (Get-Date).ToString("o")
} | ConvertTo-Json | Set-Content -Path $BackupFile -Encoding UTF8

Write-Host "即将设置 [$alias] DNS = $($servers -join ', ') （预设 $Preset）"
$confirm = Read-Host "确认？输入 yes"
if ($confirm -ne "yes") { Write-Host "已取消，未修改"; exit 0 }

Set-DnsClientServerAddress -InterfaceAlias $alias -ServerAddresses $servers

Write-Host ">>> 修改后"
Show-Current $alias
Write-Host "备份: $BackupFile"
Clear-DnsClientCache
