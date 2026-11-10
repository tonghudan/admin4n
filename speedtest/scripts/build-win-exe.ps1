# 必须在 Windows 本机执行（Linux/云端无法交叉生成可用的 win EXE）
# 用法（在 speedtest 目录）:
#   powershell -ExecutionPolicy Bypass -File scripts\build-win-exe.ps1
#
# 生成: dist\cewangsu.exe
# 日常使用更推荐双击「启动测网速.bat」（可自动准备便携 Node）

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

if ($env:OS -notlike "*Windows*") {
  Write-Host "请在 Windows 上运行本脚本。"
  exit 1
}

npm install --registry=https://registry.npmmirror.com
npm install -D @yao-pkg/pkg --registry=https://registry.npmmirror.com

$Entry = Join-Path $Root "server\pkg-entry.cjs"
if (-not (Test-Path $Entry)) { throw "缺少 server\pkg-entry.cjs" }

New-Item -ItemType Directory -Force -Path (Join-Path $Root "dist") | Out-Null
npx pkg $Entry --targets node20-win-x64 --output dist/cewangsu.exe

Write-Host "已生成: $Root\dist\cewangsu.exe"
Write-Host "请连同 public\、scripts\ 一起分发；或优先使用 启动测网速.bat"
