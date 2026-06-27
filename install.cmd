@echo off
setlocal EnableExtensions
set "REPO=ceeyang/zentao_mcp"
set "BRANCH=main"

if exist "%~dp0install.ps1" if exist "%~dp0scripts\install.mjs" (
  cd /d "%~dp0"
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1" %*
  exit /b %ERRORLEVEL%
)

echo → 从 GitHub 下载安装脚本 ...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference='Stop';" ^
  "$repo=$env:REPO; if ($env:ZENTAO_MCP_REPO) { $repo=$env:ZENTAO_MCP_REPO };" ^
  "$branch=$env:BRANCH; if ($env:ZENTAO_MCP_BRANCH) { $branch=$env:ZENTAO_MCP_BRANCH };" ^
  "$url=\"https://raw.githubusercontent.com/$repo/$branch/install.ps1\";" ^
  "$script = irm $url;" ^
  "Invoke-Expression $script"

exit /b %ERRORLEVEL%
