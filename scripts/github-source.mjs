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
  };
}

export function printInstallOneLiners(config = readRepoConfig()) {
  const urls = getGithubUrls(config);
  console.log(`
禅道 MCP 一键安装（无需 clone 仓库）

macOS / Linux — 复制这一条即可:
  curl -fsSL ${urls.installShUrl} | bash

Windows PowerShell:
  irm ${urls.installPs1Url} | iex

Windows CMD:
  curl -fsSL ${urls.installCmdUrl} -o %TEMP%\\zentao-install.cmd && %TEMP%\\zentao-install.cmd

安装过程会提示输入禅道账号；也可选「稍后配置」，再编辑 MCP 配置文件 env。

CI / 批量部署（非交互）:
  ZENTAO_URL=... ZENTAO_ACCOUNT=... ZENTAO_PASSWORD=... \\
  curl -fsSL ${urls.installShUrl} | bash -s -- --yes

稍后配置账号:
  curl -fsSL ${urls.installShUrl} | bash -s -- --yes --skip-credentials

仓库: https://github.com/${urls.github}
安装目录: ${resolveInstallDir(config)}
`);
}

const isMain =
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isMain) {
  printInstallOneLiners();
}
