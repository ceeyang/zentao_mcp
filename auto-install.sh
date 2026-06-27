#!/usr/bin/env bash
# 禅道 MCP 全自动安装（零交互）
#
# 用法 1 — 本地（已 clone）:
#   cp .env.install.example .env.install   # 填写禅道凭据
#   ./auto-install.sh
#
# 用法 2 — GitHub 网络安装:
#   curl -fsSL https://raw.githubusercontent.com/ceeyang/zentao_mcp/main/auto-install.sh | bash
#
# 用法 3 — 纯环境变量（CI / 批量）:
#   ZENTAO_URL=... ZENTAO_ACCOUNT=... ZENTAO_PASSWORD=... INSTALL_PLATFORMS=all \
#     curl -fsSL .../auto-install.sh | bash
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
  curl -fsSL "https://github.com/${REPO}/archive/refs/heads/${BRANCH}.tar.gz" -o "${archive}"
  mkdir -p "${INSTALL_DIR}"
  rm -rf "${INSTALL_DIR:?}/"*
  tar -xzf "${archive}" -C "${tmp}"
  extracted="$(find "${tmp}" -mindepth 1 -maxdepth 1 -type d | head -1)"
  cp -R "${extracted}/." "${INSTALL_DIR}/"
  rm -rf "${tmp}"
  echo "→ 已安装到 ${INSTALL_DIR}"
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

_load_env_file() {
  local file="$1"
  [[ -f "$file" ]] || return 0
  echo "→ 加载配置 ${file}"
  set -a
  # shellcheck disable=SC1090
  source "$file"
  set +a
}

if ! _is_local_install; then
  _ensure_github_source
  exec "${INSTALL_DIR}/auto-install.sh" "$@"
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${ROOT}"

ENV_FILE="${ZENTAO_ENV_FILE:-${ROOT}/.env.install}"
_load_env_file "${ENV_FILE}"
_load_env_file "${ROOT}/.env"

: "${INSTALL_PLATFORMS:=auto}"
export INSTALL_PLATFORMS

if [[ -z "${ZENTAO_URL:-}" || -z "${ZENTAO_ACCOUNT:-}" || -z "${ZENTAO_PASSWORD:-}" ]]; then
  cat >&2 <<EOF
错误: 缺少禅道凭据。请任选一种方式：

  1) 复制并填写配置文件:
       cp .env.install.example .env.install

  2) 设置环境变量:
       export ZENTAO_URL=...
       export ZENTAO_ACCOUNT=...
       export ZENTAO_PASSWORD=...

  3) 网络安装时 inline:
       ZENTAO_URL=... ZENTAO_ACCOUNT=... ZENTAO_PASSWORD=... curl ... | bash

可选: INSTALL_PLATFORMS=auto|all|cursor,claude,...
EOF
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "错误: 未找到 node，请先安装 Node.js 18+" >&2
  exit 1
fi

NODE_MAJOR="$(node -p "process.versions.node.split('.')[0]")"
if [[ "${NODE_MAJOR}" -lt 18 ]]; then
  echo "错误: 需要 Node.js >= 18，当前 $(node -v)" >&2
  exit 1
fi

echo "=== 禅道 MCP 全自动安装 ==="
echo "  平台: ${INSTALL_PLATFORMS}"
echo "  禅道: ${ZENTAO_URL}"
echo ""

exec node "${ROOT}/scripts/install.mjs" --yes "$@"
