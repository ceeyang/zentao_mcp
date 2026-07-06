#!/usr/bin/env node
/**
 * 禅道 MCP 一键安装：写入多个 AI 平台的 MCP 配置。
 *
 * 用户只需: curl -fsSL .../install.sh | bash
 */
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import {
  applyPlatformConfig,
  collectCredentials,
  detectInstallMode,
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
    skipCredentials: false,
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
    else if (arg === "--skip-credentials") options.skipCredentials = true;
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
禅道 MCP 一键安装 / 更新

一条命令（无需 clone，已安装则自动更新）:
  curl -fsSL https://raw.githubusercontent.com/ceeyang/zentao_mcp/main/install.sh | bash

Options:
  -p, --platforms <list>    auto（默认）/ all / cursor,claude,...
  --detect-platforms        打印本机检测到的平台
  --list-platforms          列出支持的平台
  --show-urls               打印网络安装命令
  --skip-build              跳过 npm run build
  -y, --yes                 非交互（需环境变量或 --skip-credentials）
  --skip-credentials        非交互且不填禅道账号（稍后编辑 MCP 配置）
  -h, --help                显示帮助

更新说明:
  重复执行上述命令即可更新；已配置账号与 MCP 平台会自动保留并刷新。

Environment（仅 CI / 批量部署）:
  ZENTAO_URL / ZENTAO_ACCOUNT / ZENTAO_PASSWORD
  INSTALL_PLATFORMS           auto / all / 逗号列表
  ZENTAO_NODE_PATH            指定 node 绝对路径

Supported platforms:
  ${Object.entries(PLATFORMS)
    .map(([key, item]) => `${key} (${item.label})`)
    .join("\n  ")}
`);
}

function runNpmInstall(projectRoot, isUpdate) {
  console.log(isUpdate ? "→ 更新依赖 npm install ..." : "→ 安装依赖 npm install ...");
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

function printConfigureLaterHint(results) {
  console.log(`
⚠ 禅道账号尚未配置。请在以下文件的 zentao.env 中填写:
   ZENTAO_URL / ZENTAO_ACCOUNT / ZENTAO_PASSWORD`);
  for (const item of results) {
    console.log(`   - ${item.configPath}`);
  }
  console.log("");
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
  const { isUpdate, configuredPlatforms, version } = detectInstallMode(projectRoot);

  console.log("");
  console.log(isUpdate ? "=== 禅道 MCP 更新 ===" : "=== 禅道 MCP 安装 ===");
  console.log(`  目录: ${projectRoot}`);
  if (isUpdate && version) {
    console.log(`  版本: v${version}`);
  }
  console.log("");

  runNpmInstall(projectRoot, isUpdate);

  if (!options.skipBuild) {
    runBuild(projectRoot);
  }

  ensureBuilt(projectRoot);
  const entryPath = resolveEntryPath(projectRoot);
  const nodePath = resolveNodePath();

  const { env, credentialsSkipped } = await collectCredentials(projectRoot, {
    ...options,
    isUpdate,
  });
  if (
    !credentialsSkipped &&
    (!env.ZENTAO_URL || !env.ZENTAO_ACCOUNT || !env.ZENTAO_PASSWORD)
  ) {
    throw new Error("ZENTAO_URL / ZENTAO_ACCOUNT / ZENTAO_PASSWORD 不能为空");
  }

  const selected = await selectPlatforms({
    ...options,
    isUpdate,
    configuredPlatforms,
  });
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

  console.log(isUpdate ? "\n=== 更新完成 ===\n" : "\n=== 安装完成 ===\n");
  for (const item of results) {
    console.log(`[${item.label}] ${item.configPath}`);
    if (item.backupPath) console.log(`  备份: ${item.backupPath}`);
  }

  if (credentialsSkipped) {
    printConfigureLaterHint(results);
  }

  console.log(`下一步:
  1. 完全重启对应 AI 客户端
  2. 在 MCP 面板确认 "${SERVER_NAME}" 已连接
  3. 对话测试: "调用 zentao_health_check 检查禅道连接"
${isUpdate ? "  （更新后务必重启客户端以加载新版本）" : ""}
`);
}

main().catch((error) => {
  console.error(`\n安装失败: ${error instanceof Error ? error.message : error}`);
  process.exit(1);
});
