# 禅道 MCP 全自动安装 (Windows PowerShell，零交互)
#
# 用法 1 — 本地:
#   Copy-Item .env.install.example .env.install   # 填写凭据
#   .\auto-install.ps1
#
# 用法 2 — 网络:
#   irm https://raw.githubusercontent.com/ceeyang/zentao_mcp/main/auto-install.ps1 | iex
param(
  [switch]$SkipBuild,
  [switch]$Help
)

$ErrorActionPreference = "Stop"

$Repo = if ($env:ZENTAO_MCP_REPO) { $env:ZENTAO_MCP_REPO } else { "ceeyang/zentao_mcp" }
$Branch = if ($env:ZENTAO_MCP_BRANCH) { $env:ZENTAO_MCP_BRANCH } else { "main" }
$InstallDir = if ($env:ZENTAO_MCP_INSTALL_DIR) {
  $env:ZENTAO_MCP_INSTALL_DIR
} else {
  Join-Path $env:LOCALAPPDATA "zentao-mcp"
}

function Test-LocalInstall {
  param([string]$Root)
  return Test-Path (Join-Path $Root "scripts\install.mjs")
}

function Sync-FromGitHub {
  $git = Get-Command git -ErrorAction SilentlyContinue
  if ($git) {
    Write-Host "→ 从 GitHub 同步 $Repo ($Branch) ..."
    if (Test-Path (Join-Path $InstallDir ".git")) {
      git -C $InstallDir fetch --depth 1 origin $Branch
      git -C $InstallDir reset --hard "origin/$Branch"
    } else {
      if (Test-Path $InstallDir) { Remove-Item -Recurse -Force $InstallDir }
      git clone --depth 1 --branch $Branch "https://github.com/$Repo.git" $InstallDir
    }
  } else {
    Write-Host "→ 从 GitHub 下载 $Repo ($Branch) ..."
    $zipUrl = "https://github.com/$Repo/archive/refs/heads/$Branch.zip"
    $tmpZip = Join-Path $env:TEMP "zentao-mcp.zip"
    $tmpDir = Join-Path $env:TEMP "zentao-mcp-extract"
    Invoke-WebRequest -Uri $zipUrl -OutFile $tmpZip -UseBasicParsing
    if (Test-Path $tmpDir) { Remove-Item -Recurse -Force $tmpDir }
    Expand-Archive -Path $tmpZip -DestinationPath $tmpDir -Force
    $extracted = Get-ChildItem -Path $tmpDir -Directory | Select-Object -First 1
    if (Test-Path $InstallDir) { Remove-Item -Recurse -Force $InstallDir }
    New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
    Copy-Item -Path (Join-Path $extracted.FullName "*") -Destination $InstallDir -Recurse -Force
    Remove-Item -Recurse -Force $tmpDir, $tmpZip -ErrorAction SilentlyContinue
  }
  Write-Host "→ 已安装到 $InstallDir"
}

function Import-DotEnvFile {
  param([string]$Path)
  if (-not (Test-Path $Path)) { return }
  Write-Host "→ 加载配置 $Path"
  Get-Content $Path | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith("#")) { return }
    $idx = $line.IndexOf("=")
    if ($idx -le 0) { return }
    $key = $line.Substring(0, $idx).Trim()
    $value = $line.Substring($idx + 1).Trim()
    if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
      $value = $value.Substring(1, $value.Length - 2)
    }
    if (-not (Get-Item -Path "env:$key" -ErrorAction SilentlyContinue)) {
      Set-Item -Path "env:$key" -Value $value
    }
  }
}

$scriptPath = $MyInvocation.MyCommand.Path
$Root = if ($scriptPath) { Split-Path -Parent $scriptPath } else { $null }

if (-not $Root -or -not (Test-LocalInstall -Root $Root)) {
  Sync-FromGitHub
  $Root = $InstallDir
}

Set-Location $Root

$envFile = if ($env:ZENTAO_ENV_FILE) { $env:ZENTAO_ENV_FILE } else { Join-Path $Root ".env.install" }
Import-DotEnvFile $envFile
Import-DotEnvFile (Join-Path $Root ".env")

if (-not $env:INSTALL_PLATFORMS) { $env:INSTALL_PLATFORMS = "auto" }

if (-not $env:ZENTAO_URL -or -not $env:ZENTAO_ACCOUNT -or -not $env:ZENTAO_PASSWORD) {
  @"
错误: 缺少禅道凭据。请任选一种方式:

  1) Copy-Item .env.install.example .env.install  并填写
  2) `$env:ZENTAO_URL / ZENTAO_ACCOUNT / ZENTAO_PASSWORD
  3) 网络安装时 inline 环境变量

可选: INSTALL_PLATFORMS=auto|all|cursor,claude,...
"@ | Write-Error
  exit 1
}

$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) { throw "未找到 node，请先安装 Node.js 18+" }

Write-Host "=== 禅道 MCP 全自动安装 ==="
Write-Host "  平台: $($env:INSTALL_PLATFORMS)"
Write-Host "  禅道: $($env:ZENTAO_URL)"
Write-Host ""

$argsList = @("$Root\scripts\install.mjs", "--yes")
if ($SkipBuild) { $argsList += "--skip-build" }
if ($Help) { $argsList += "--help" }

& $node.Source @argsList
exit $LASTEXITCODE
