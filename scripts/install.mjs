#!/usr/bin/env node
/**
 * 禅道 MCP 一键安装：写入多个 AI 平台的 MCP 配置。
 *
 * Usage:
 *   node scripts/install.mjs
 *   node scripts/install.mjs --platforms cursor,claude,windsurf
 *   ZENTAO_URL=... ZENTAO_ACCOUNT=... ZENTAO_PASSWORD=... node scripts/install.mjs --yes
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  applyPlatformConfig,
  applyEnvInstall,
  collectCredentials,
  detectInstalledPlatforms,
  ensureBuilt,
  getProjectRoot,
  PLATFORMS,
  resolveEntryPath,
  resolveNodePath,
  selectPlatforms,
  SERVER_NAME,
} from "./install-lib.mjs";
import {
  printInstallOneLiners,
  readRepoConfig,
} from "./github-source.mjs";

function parseArgs(argv) {
  const options = {
    nonInteractive: false,
    platforms: null,
    skipBuild: false,
    listPlatforms: false,
    detectPlatforms: false,
    showUrls: false,
    help: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--yes" || arg === "-y") options.nonInteractive = true;
    else if (arg === "--skip-build") options.skipBuild = true;
    else if (arg === "--list-platforms") options.listPlatforms = true;
    else if (arg === "--detect-platforms") options.detectPlatforms = true;
    else if (arg === "--show-urls") options.showUrls = true;
    else if (arg === "--help" || arg === "-h") options.help = true;
    else if (arg === "--platforms" || arg === "-p") {
      options.platforms = argv[i + 1] ?? "";
      i += 1;
    }
  }
  return options;
}

function printHelp() {
  console.log(`
禅道 MCP 一键安装

Usage:
  ./install.sh
  curl -fsSL https://raw.githubusercontent.com/ceeyang/zentao_mcp/main/install.sh | bash
  node scripts/install.mjs [options]

Options:
  -y, --yes                 非交互模式（需环境变量或 .env）
  -p, --platforms <list>    目标平台：auto / all / cursor,claude,...
  --detect-platforms        打印本机检测到的平台（逗号分隔）
  --list-platforms          列出支持的平台
  --show-urls               打印 GitHub 网络一键安装命令
  --skip-build              跳过 npm run build
  -h, --help                显示帮助

GitHub:
  ZENTAO_MCP_REPO           默认 ceeyang/zentao_mcp
  ZENTAO_MCP_BRANCH         默认 main
  ZENTAO_MCP_INSTALL_DIR    默认 ~/.local/share/zentao-mcp

Environment:
  ZENTAO_URL / ZENTAO_ACCOUNT / ZENTAO_PASSWORD
  ZENTAO_SKIP_SSL / ZENTAO_ALLOW_RESOLVE_BUG
  INSTALL_PLATFORMS         非交互模式：auto（默认）/ all / 逗号列表
  ZENTAO_ENV_FILE           凭据文件路径，默认 .env.install
  ZENTAO_NODE_PATH          指定 node 可执行文件绝对路径

Supported platforms:
  ${Object.entries(PLATFORMS)
    .map(([key, item]) => `${key} (${item.label})`)
    .join("\n  ")}
`);
}

function runBuild(projectRoot) {
  console.log("→ 构建 MCP Server ...");
  const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
  const result = spawnSync(npmCmd, ["run", "build"], {
    cwd: projectRoot,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.status !== 0) {
    throw new Error("npm run build failed");
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }
  if (options.showUrls) {
    printInstallOneLiners(readRepoConfig(getProjectRoot()));
    return;
  }
  if (options.listPlatforms) {
    for (const [key, item] of Object.entries(PLATFORMS)) {
      const paths = item.getConfigPaths().join("; ");
      console.log(`${key}\t${item.label}\t${paths}`);
    }
    return;
  }
  if (options.detectPlatforms) {
    console.log(detectInstalledPlatforms().join(","));
    return;
  }

  const projectRoot = getProjectRoot();
  applyEnvInstall(projectRoot);
  console.log(`项目目录: ${projectRoot}`);

  if (!existsSync(join(projectRoot, "node_modules"))) {
    console.log("→ 安装依赖 npm install ...");
    const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
    const install = spawnSync(npmCmd, ["install"], {
      cwd: projectRoot,
      stdio: "inherit",
      shell: process.platform === "win32",
    });
    if (install.status !== 0) {
      throw new Error("npm install failed");
    }
  }

  if (!options.skipBuild) {
    runBuild(projectRoot);
  }

  ensureBuilt(projectRoot);
  const entryPath = resolveEntryPath(projectRoot);
  const nodePath = resolveNodePath();

  const env = await collectCredentials(projectRoot, options);
  if (!env.ZENTAO_URL || !env.ZENTAO_ACCOUNT || !env.ZENTAO_PASSWORD) {
    throw new Error("ZENTAO_URL / ZENTAO_ACCOUNT / ZENTAO_PASSWORD 不能为空");
  }

  const selected = await selectPlatforms(options);
  if (selected.length === 0) {
    throw new Error("未选择任何平台");
  }

  console.log("\n→ 写入 MCP 配置 ...");
  console.log(`  node:   ${nodePath}`);
  console.log(`  entry:  ${entryPath}`);

  const results = [];
  for (const key of selected) {
    const merged = applyPlatformConfig(key, SERVER_NAME, { nodePath, entryPath, env });
    results.push(merged);
    console.log(`  ✓ ${merged.label}: ${merged.configPath}`);
  }

  console.log("\n=== 安装完成 ===\n");
  for (const item of results) {
    console.log(`[${item.label}] ${item.configPath}`);
    if (item.backupPath) console.log(`  备份: ${item.backupPath}`);
  }

  console.log(`
下一步:
  1. 完全重启对应 AI 客户端（Cursor / Claude Desktop / Windsurf 等）
  2. 在 MCP 面板确认 "${SERVER_NAME}" 已连接
  3. 对话测试: "调用 zentao_health_check 检查禅道连接"

自检:
  npm run smoke
`);
}

main().catch((error) => {
  console.error(`\n安装失败: ${error instanceof Error ? error.message : error}`);
  process.exit(1);
});
