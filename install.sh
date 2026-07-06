#!/usr/bin/env bash
# 禅道 MCP 一键安装 / 更新 — 无需 clone，一条命令即可
#
#   curl -fsSL https://raw.githubusercontent.com/ceeyang/zentao_mcp/main/install.sh | bash
#
# 首次安装：下载到 ~/.local/share/zentao-mcp → npm install → 构建 → 交互配置
# 再次执行：自动从 GitHub 同步最新代码并更新依赖，保留 .env 与 node_modules
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

_overlay_repo_to_install_dir() {
  local extracted="$1"
  mkdir -p "${INSTALL_DIR}"

  if command -v rsync >/dev/null 2>&1; then
    rsync -a --delete \
      --exclude node_modules \
      --exclude .env \
      "${extracted}/." "${INSTALL_DIR}/"
    return
  fi

  local item name
  for item in "${INSTALL_DIR}"/* "${INSTALL_DIR}"/.[!.]* "${INSTALL_DIR}"/..?*; do
    [[ -e "${item}" ]] || continue
    name="$(basename "${item}")"
    [[ "${name}" == "node_modules" || "${name}" == ".env" ]] && continue
    rm -rf "${item}"
  done
  cp -R "${extracted}/." "${INSTALL_DIR}/"
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

  tar -xzf "${archive}" -C "${tmp}"
  extracted="$(find "${tmp}" -mindepth 1 -maxdepth 1 -type d | head -1)"

  if [[ -z "${extracted}" || ! -f "${extracted}/scripts/install.mjs" ]]; then
    echo "错误: 解压后未找到安装脚本" >&2
    rm -rf "${tmp}"
    exit 1
  fi

  if [[ -f "${INSTALL_DIR}/scripts/install.mjs" ]]; then
    echo "→ 检测到已有安装，正在更新 ..."
  else
    echo "→ 首次安装，下载到 ${INSTALL_DIR} ..."
  fi

  _overlay_repo_to_install_dir "${extracted}"
  rm -rf "${tmp}"
  echo "→ 已同步到 ${INSTALL_DIR}"
}

_sync_from_github() {
  echo "→ 从 GitHub 同步 ${REPO} (${BRANCH}) ..."
  if [[ -d "${INSTALL_DIR}/.git" ]]; then
    git -C "${INSTALL_DIR}" fetch --depth 1 origin "${BRANCH}"
    git -C "${INSTALL_DIR}" reset --hard "origin/${BRANCH}"
  elif [[ -f "${INSTALL_DIR}/scripts/install.mjs" ]]; then
    echo "→ 检测到已有安装（无 git），使用归档覆盖更新 ..."
    _download_from_github
    return
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

exec node "${ROOT}/scripts/install.mjs" "$@"
