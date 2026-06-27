#!/usr/bin/env bash
# 禅道 MCP 一键安装 — 无需 clone，一条命令即可
#
#   curl -fsSL https://raw.githubusercontent.com/ceeyang/zentao_mcp/main/install.sh | bash
#
# 脚本会自动：下载到 ~/.local/share/zentao-mcp → npm install → 构建 → 交互配置
# 禅道账号可安装时输入，也可选「稍后配置」再编辑 MCP 配置文件
set -euo pipefail

REPO="${ZENTAO_MCP_REPO:-ceeyang/zentao_mcp}"
BRANCH="${ZENTAO_MCP_BRANCH:-main}"
INSTALL_DIR="${ZENTAO_MCP_INSTALL_DIR:-${HOME}/.local/share/zentao-mcp}"

_is_local_install() {
  [[ -n "${BASH_SOURCE[0]:-}" ]] || return 1
  local dir
  dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  [[ -f "${dir}/scripts/install.mjs" ]]
}

_download_from_github() {
  local archive tmp extracted
  tmp="$(mktemp -d)"
  archive="${tmp}/repo.tar.gz"

  echo "→ 从 GitHub 下载 ${REPO} (${BRANCH}) ..."
  if ! curl -fsSL "https://github.com/${REPO}/archive/refs/heads/${BRANCH}.tar.gz" -o "${archive}"; then
    echo "错误: 下载失败，请检查网络或仓库地址" >&2
    rm -rf "${tmp}"
    exit 1
  fi

  mkdir -p "${INSTALL_DIR}"
  rm -rf "${INSTALL_DIR:?}/"*
  tar -xzf "${archive}" -C "${tmp}"
  extracted="$(find "${tmp}" -mindepth 1 -maxdepth 1 -type d | head -1)"

  if [[ -z "${extracted}" || ! -f "${extracted}/scripts/install.mjs" ]]; then
    echo "错误: 解压后未找到安装脚本" >&2
    rm -rf "${tmp}"
    exit 1
  fi

  cp -R "${extracted}/." "${INSTALL_DIR}/"
  rm -rf "${tmp}"
  echo "→ 已下载到 ${INSTALL_DIR}"
}

_sync_from_github() {
  echo "→ 从 GitHub 同步 ${REPO} (${BRANCH}) ..."
  if [[ -d "${INSTALL_DIR}/.git" ]]; then
    git -C "${INSTALL_DIR}" fetch --depth 1 origin "${BRANCH}"
    git -C "${INSTALL_DIR}" reset --hard "origin/${BRANCH}"
  else
    rm -rf "${INSTALL_DIR}"
    git clone --depth 1 --branch "${BRANCH}" "https://github.com/${REPO}.git" "${INSTALL_DIR}"
  fi
  echo "→ 已同步到 ${INSTALL_DIR}"
}

_ensure_github_source() {
  mkdir -p "$(dirname "${INSTALL_DIR}")"
  if command -v git >/dev/null 2>&1; then
    _sync_from_github
  else
    _download_from_github
  fi
}

if ! _is_local_install; then
  _ensure_github_source
  exec "${INSTALL_DIR}/install.sh" "$@"
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${ROOT}"

if ! command -v node >/dev/null 2>&1; then
  echo "错误: 未找到 node，请先安装 Node.js 18+" >&2
  exit 1
fi

NODE_MAJOR="$(node -p "process.versions.node.split('.')[0]")"
if [[ "${NODE_MAJOR}" -lt 18 ]]; then
  echo "错误: 需要 Node.js >= 18，当前 $(node -v)" >&2
  exit 1
fi

echo ""
echo "=== 禅道 MCP 安装 ==="
echo "  安装目录: ${ROOT}"
echo ""

exec node "${ROOT}/scripts/install.mjs" "$@"
