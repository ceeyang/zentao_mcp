#!/usr/bin/env bash
# 维护者用：模拟「网络安装」后的本地安装阶段，验证一键流程（不访问 GitHub）
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TEST_DIR="${ZENTAO_MCP_E2E_DIR:-/tmp/zentao-mcp-e2e-test}"

echo "=== E2E: 模拟 GitHub 下载到 ${TEST_DIR} ==="
rm -rf "${TEST_DIR}"
mkdir -p "${TEST_DIR}"

rsync -a \
  --exclude node_modules \
  --exclude release \
  --exclude .git \
  "${ROOT}/" "${TEST_DIR}/"

cd "${TEST_DIR}"
echo "→ npm install"
npm install --silent
echo "→ npm run build"
npm run build

if [[ ! -f dist/index.js ]]; then
  echo "FAIL: dist/index.js 不存在" >&2
  exit 1
fi

echo "→ install.mjs --help"
node scripts/install.mjs --help >/dev/null

echo "→ install.mjs --list-platforms"
node scripts/install.mjs --list-platforms | head -3

echo ""
echo "PASS: 安装阶段（npm install + build + install.mjs）正常"
echo "网络一键安装流程："
echo "  1) curl | bash  → 从 GitHub 下载到 ~/.local/share/zentao-mcp"
echo "  2) 自动 npm install + build"
echo "  3) 交互/非交互写入 MCP 配置"
echo ""
echo "发布 GitHub 后同事执行："
echo "  curl -fsSL https://raw.githubusercontent.com/ceeyang/zentao_mcp/main/install.sh | bash"
