import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const DEFAULT = {
  github: "ceeyang/zentao_mcp",
  branch: "main",
  installDir: "~/.local/share/zentao-mcp",
};

export function getProjectRoot() {
  return resolve(fileURLToPath(new URL("..", import.meta.url)));
}

export function readRepoConfig(projectRoot = getProjectRoot()) {
  try {
    const raw = readFileSync(join(projectRoot, "repo.config.json"), "utf8");
    return { ...DEFAULT, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT };
  }
}

export function resolveInstallDir(config, env = process.env) {
  const raw =
    env.ZENTAO_MCP_INSTALL_DIR ||
    config.installDir ||
    DEFAULT.installDir;
  if (raw.startsWith("~/")) {
    return join(homedir(), raw.slice(2));
  }
  return raw;
}

export function getGithubUrls(config, env = process.env) {
  const github = env.ZENTAO_MCP_REPO || config.github || DEFAULT.github;
  const branch = env.ZENTAO_MCP_BRANCH || config.branch || DEFAULT.branch;
  const [owner, repo] = github.includes("/")
    ? github.split("/", 2)
    : [github, "zentao_mcp"];

  const slug = `${owner}/${repo}`;
  const rawBase = `https://raw.githubusercontent.com/${slug}/${branch}`;

  return {
    github: slug,
    owner,
    repo,
    branch,
    cloneUrl: `https://github.com/${slug}.git`,
    archiveTarUrl: `https://github.com/${slug}/archive/refs/heads/${branch}.tar.gz`,
    archiveZipUrl: `https://github.com/${slug}/archive/refs/heads/${branch}.zip`,
    rawBase,
    installShUrl: `${rawBase}/install.sh`,
    installPs1Url: `${rawBase}/install.ps1`,
    installCmdUrl: `${rawBase}/install.cmd`,
    autoInstallShUrl: `${rawBase}/auto-install.sh`,
    autoInstallPs1Url: `${rawBase}/auto-install.ps1`,
  };
}

export function printInstallOneLiners(config = readRepoConfig()) {
  const urls = getGithubUrls(config);
  console.log(`
GitHub 一键安装（网络地址）

交互式安装（macOS / Linux）:
  curl -fsSL ${urls.installShUrl} | bash

全自动安装（推荐，零交互）:
  cp .env.install.example .env.install   # 填写凭据后
  curl -fsSL ${urls.autoInstallShUrl} | bash

或 inline 环境变量:
  ZENTAO_URL=https://zentao.example.com \\
  ZENTAO_ACCOUNT=your_account \\
  ZENTAO_PASSWORD=your_password \\
  ZENTAO_SKIP_SSL=true \\
  INSTALL_PLATFORMS=auto \\
  curl -fsSL ${urls.autoInstallShUrl} | bash

非交互（install.sh）:
  ZENTAO_URL=https://zentao.example.com \\
  ZENTAO_ACCOUNT=your_account \\
  ZENTAO_PASSWORD=your_password \\
  INSTALL_PLATFORMS=cursor,claude \\
  curl -fsSL ${urls.installShUrl} | bash -s -- --yes

Windows PowerShell（全自动）:
  irm ${urls.autoInstallPs1Url} | iex

Windows PowerShell（交互）:
  irm ${urls.installPs1Url} | iex

Windows CMD:
  curl -fsSL ${urls.installCmdUrl} -o %TEMP%\\zentao-install.cmd && %TEMP%\\zentao-install.cmd

仓库: https://github.com/${urls.github}
分支: ${urls.branch}
安装目录: ${resolveInstallDir(config)}
Raw 全自动脚本: ${urls.autoInstallShUrl}
`);
}

const isMain =
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isMain) {
  printInstallOneLiners();
}
