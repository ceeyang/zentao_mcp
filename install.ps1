# 禅道 MCP 一键安装 / 更新 (Windows PowerShell)
# 一条命令，无需 clone；已安装则自动更新:
#   irm https://raw.githubusercontent.com/ceeyang/zentao_mcp/main/install.ps1 | iex
param(
  [switch]$Yes,
  [string]$Platforms,
  [switch]$SkipBuild,
  [switch]$SkipCredentials,
  [switch]$ListPlatforms,
  [switch]$Help,
  [switch]$ShowUrls
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

function Copy-RepoOverlay {
  param(
    [string]$SourceDir,
    [string]$TargetDir
  )

  if (-not (Test-Path $TargetDir)) {
    New-Item -ItemType Directory -Path $TargetDir -Force | Out-Null
  }

  $exclude = @("node_modules", ".env")
  Get-ChildItem -Path $SourceDir -Force | ForEach-Object {
    if ($exclude -contains $_.Name) { return }
    $dest = Join-Path $TargetDir $_.Name
    if ($_.PSIsContainer) {
      if (Test-Path $dest) { Remove-Item -Recurse -Force $dest }
      Copy-Item -Path $_.FullName -Destination $dest -Recurse -Force
    } else {
      Copy-Item -Path $_.FullName -Destination $dest -Force
    }
  }
}

function Sync-FromArchive {
  Write-Host "→ 从 GitHub 下载 $Repo ($Branch) ..."
  $zipUrl = "https://github.com/$Repo/archive/refs/heads/$Branch.zip"
  $tmpZip = Join-Path $env:TEMP "zentao-mcp.zip"
  $tmpDir = Join-Path $env:TEMP "zentao-mcp-extract"
  Invoke-WebRequest -Uri $zipUrl -OutFile $tmpZip -UseBasicParsing
  if (Test-Path $tmpDir) { Remove-Item -Recurse -Force $tmpDir }
  Expand-Archive -Path $tmpZip -DestinationPath $tmpDir -Force
  $extracted = Get-ChildItem -Path $tmpDir -Directory | Select-Object -First 1
  if (-not $extracted -or -not (Test-Path (Join-Path $extracted.FullName "scripts\install.mjs"))) {
    throw "解压后未找到 scripts/install.mjs"
  }

  if (Test-LocalInstall -Root $InstallDir) {
    Write-Host "→ 检测到已有安装，正在更新 ..."
  } else {
    Write-Host "→ 首次安装，下载到 $InstallDir ..."
  }

  Copy-RepoOverlay -SourceDir $extracted.FullName -TargetDir $InstallDir
  Remove-Item -Recurse -Force $tmpDir, $tmpZip -ErrorAction SilentlyContinue
  Write-Host "→ 已同步到 $InstallDir"
}

function Sync-FromGitHub {
  $git = Get-Command git -ErrorAction SilentlyContinue
  if ($git) {
    Write-Host "→ 从 GitHub 同步 $Repo ($Branch) ..."
    if (Test-Path (Join-Path $InstallDir ".git")) {
      git -C $InstallDir fetch --depth 1 origin $Branch
      git -C $InstallDir reset --hard "origin/$Branch"
    } elseif (Test-LocalInstall -Root $InstallDir) {
      Write-Host "→ 检测到已有安装（无 git），使用归档覆盖更新 ..."
      Sync-FromArchive
      return
    } else {
      if (Test-Path $InstallDir) { Remove-Item -Recurse -Force $InstallDir }
      git clone --depth 1 --branch $Branch "https://github.com/$Repo.git" $InstallDir
    }
  } else {
    Sync-FromArchive
  }
  Write-Host "→ 已同步到 $InstallDir"
}

function Get-NodeCommand {
  $node = Get-Command node -ErrorAction SilentlyContinue
  if (-not $node) {
    throw "未找到 node，请先安装 Node.js 18+：https://nodejs.org/"
  }
  return $node.Source
}

$scriptPath = $MyInvocation.MyCommand.Path
$Root = if ($scriptPath) { Split-Path -Parent $scriptPath } else { $null }

if (-not $Root -or -not (Test-LocalInstall -Root $Root)) {
  Sync-FromGitHub
  $Root = $InstallDir
}

Set-Location $Root

if ($ShowUrls) {
  node "$Root\scripts\github-source.mjs"
  exit 0
}

$nodePath = Get-NodeCommand
$version = & $nodePath -p "process.versions.node"
$major = [int]($version.Split(".")[0])
if ($major -lt 18) {
  throw "需要 Node.js >= 18，当前 $version"
}

$argsList = @("$Root\scripts\install.mjs")
if ($Yes) { $argsList += "--yes" }
if ($SkipCredentials) { $argsList += "--skip-credentials" }
if ($Platforms) { $argsList += @("--platforms", $Platforms) }
if ($SkipBuild) { $argsList += "--skip-build" }
if ($ListPlatforms) { $argsList += "--list-platforms" }
if ($Help) { $argsList += "--help" }

& $nodePath @argsList
exit $LASTEXITCODE
