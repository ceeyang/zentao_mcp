import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { homedir, platform } from "node:os";
import { dirname, join, resolve } from "node:path";
import { createInterface } from "node:readline";
import { getProjectRoot } from "./github-source.mjs";

export { getProjectRoot };

export const SERVER_NAME = "zentao";

function appDataDir(...parts) {
  const base = process.env.APPDATA || join(homedir(), "AppData", "Roaming");
  return join(base, ...parts);
}

function xdgConfigDir(...parts) {
  const base = process.env.XDG_CONFIG_HOME || join(homedir(), ".config");
  return join(base, ...parts);
}

function macAppSupportDir(...parts) {
  return join(homedir(), "Library", "Application Support", ...parts);
}

function vscodeGlobalStorage(extensionId, fileName) {
  if (platform() === "darwin") {
    return join(
      macAppSupportDir("Code", "User", "globalStorage", extensionId, "settings", fileName),
    );
  }
  if (platform() === "win32") {
    return join(
      appDataDir("Code", "User", "globalStorage", extensionId, "settings", fileName),
    );
  }
  return join(
    xdgConfigDir("Code", "User", "globalStorage", extensionId, "settings", fileName),
  );
}

function traeConfigPath(appName) {
  if (platform() === "darwin") {
    return join(macAppSupportDir(appName, "User", "mcp.json"));
  }
  if (platform() === "win32") {
    return join(appDataDir(appName, "User", "mcp.json"));
  }
  return join(xdgConfigDir(appName, "User", "mcp.json"));
}

function zedSettingsPath() {
  if (platform() === "darwin") {
    return join(homedir(), ".config", "zed", "settings.json");
  }
  if (platform() === "win32") {
    return join(appDataDir("Zed", "settings.json"));
  }
  return join(xdgConfigDir("zed", "settings.json"));
}

function vscodeUserMcpPath() {
  if (platform() === "darwin") {
    return join(macAppSupportDir("Code", "User", "mcp.json"));
  }
  if (platform() === "win32") {
    return join(appDataDir("Code", "User", "mcp.json"));
  }
  return join(xdgConfigDir("Code", "User", "mcp.json"));
}

function cursorConfigPaths() {
  const paths = [join(homedir(), ".cursor", "mcp.json")];
  if (platform() === "win32") {
    paths.unshift(join(appDataDir("Cursor", "mcp.json")));
  }
  return paths;
}

function clineConfigPaths() {
  return [
    vscodeGlobalStorage("saoudrizwan.cline", "cline_mcp_settings.json"),
    vscodeGlobalStorage("saoudrizwan.claude-dev", "cline_mcp_settings.json"),
    join(homedir(), ".cline", "data", "settings", "cline_mcp_settings.json"),
  ];
}

export const PLATFORMS = {
  cursor: {
    label: "Cursor",
    getConfigPaths: cursorConfigPaths,
    serversKey: "mcpServers",
  },
  claude: {
    label: "Claude Desktop",
    getConfigPaths: () => {
      if (platform() === "darwin") {
        return [join(macAppSupportDir("Claude", "claude_desktop_config.json"))];
      }
      if (platform() === "win32") {
        return [join(appDataDir("Claude", "claude_desktop_config.json"))];
      }
      return [join(xdgConfigDir("Claude", "claude_desktop_config.json"))];
    },
    serversKey: "mcpServers",
  },
  claude_code: {
    label: "Claude Code (CLI)",
    getConfigPaths: () => [join(homedir(), ".claude.json")],
    serversKey: "mcpServers",
    withStdioType: true,
  },
  windsurf: {
    label: "Windsurf",
    getConfigPaths: () => [join(homedir(), ".codeium", "windsurf", "mcp_config.json")],
    serversKey: "mcpServers",
  },
  trae: {
    label: "Trae",
    getConfigPaths: () => [traeConfigPath("Trae")],
    serversKey: "mcpServers",
  },
  trae_cn: {
    label: "Trae CN",
    getConfigPaths: () => [traeConfigPath("Trae CN")],
    serversKey: "mcpServers",
  },
  vscode: {
    label: "VS Code (Copilot MCP)",
    getConfigPaths: () => [vscodeUserMcpPath()],
    serversKey: "servers",
    withStdioType: true,
  },
  cline: {
    label: "Cline (VS Code 插件)",
    getConfigPaths: clineConfigPaths,
    serversKey: "mcpServers",
  },
  opencode: {
    label: "OpenCode",
    getConfigPaths: () => [join(xdgConfigDir("opencode", "opencode.json"))],
    merge: mergeOpenCodeConfig,
  },
  continue: {
    label: "Continue",
    getConfigPaths: () => [join(homedir(), ".continue", "mcpServers", "mcp.json")],
    serversKey: "mcpServers",
  },
  zed: {
    label: "Zed",
    getConfigPaths: () => [zedSettingsPath()],
    merge: mergeZedConfig,
  },
  kiro: {
    label: "Kiro",
    getConfigPaths: () => [join(homedir(), ".kiro", "mcp.json")],
    serversKey: "mcpServers",
  },
  roocode: {
    label: "Roo Code",
    getConfigPaths: () => [join(homedir(), ".roo", "mcp.json")],
    serversKey: "mcpServers",
  },
  amazonq: {
    label: "Amazon Q Developer",
    getConfigPaths: () => [join(homedir(), ".aws", "amazonq", "mcp.json")],
    serversKey: "mcpServers",
  },
  copilot_cli: {
    label: "GitHub Copilot CLI",
    getConfigPaths: () => [join(homedir(), ".copilot", "mcp-config.json")],
    serversKey: "mcpServers",
  },
  gemini: {
    label: "Gemini CLI",
    getConfigPaths: () => [join(homedir(), ".gemini", "settings.json")],
    serversKey: "mcpServers",
  },
  kimi: {
    label: "Kimi CLI",
    getConfigPaths: () => [join(homedir(), ".kimi", "mcp.json")],
    serversKey: "mcpServers",
  },
  codex: {
    label: "OpenAI Codex CLI",
    getConfigPaths: () => [join(homedir(), ".codex", "config.toml")],
    merge: mergeCodexTomlConfig,
  },
};

for (const item of Object.values(PLATFORMS)) {
  if (!item.getConfigPath) {
    item.getConfigPath = () => item.getConfigPaths()[0];
  }
}

export function resolveNodePath() {
  if (process.env.ZENTAO_NODE_PATH?.trim()) {
    return resolve(process.env.ZENTAO_NODE_PATH.trim());
  }
  return process.execPath;
}

export function resolveEntryPath(projectRoot) {
  const distEntry = join(projectRoot, "dist", "index.js");
  if (existsSync(distEntry)) return distEntry;
  throw new Error(
    `Missing ${distEntry}. Run "npm install && npm run build" in the project first.`,
  );
}

function parseEnvLines(content) {
  const out = {};
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

export function loadEnvFile(projectRoot) {
  const envPath = join(projectRoot, ".env");
  if (!existsSync(envPath)) return {};
  return parseEnvLines(readFileSync(envPath, "utf8"));
}

/** 全自动安装用：读取 .env.install（不进 git） */
export function loadEnvInstallFile(projectRoot) {
  const envPath =
    process.env.ZENTAO_ENV_FILE?.trim() || join(projectRoot, ".env.install");
  if (!existsSync(envPath)) return { path: envPath, env: {} };
  return { path: envPath, env: parseEnvLines(readFileSync(envPath, "utf8")) };
}

/** 将 .env.install 中的变量注入 process.env（不覆盖已有环境变量） */
export function applyEnvInstall(projectRoot) {
  const { path, env } = loadEnvInstallFile(projectRoot);
  for (const [key, value] of Object.entries(env)) {
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
  return path;
}

function pathExists(path) {
  try {
    return existsSync(path);
  } catch {
    return false;
  }
}

/** 根据本机已安装的 AI 客户端推断目标平台 */
export function detectInstalledPlatforms() {
  const detected = [];

  for (const [key, def] of Object.entries(PLATFORMS)) {
    if (def.getConfigPaths().some((p) => pathExists(p))) {
      detected.push(key);
      continue;
    }

    let likely = false;
    switch (key) {
      case "cursor":
        likely =
          pathExists(join(homedir(), ".cursor")) ||
          (platform() === "win32" && pathExists(appDataDir("Cursor")));
        break;
      case "claude":
        likely = pathExists(dirname(def.getConfigPath()));
        break;
      case "claude_code":
        likely =
          pathExists(join(homedir(), ".claude.json")) ||
          pathExists(join(homedir(), ".claude"));
        break;
      case "windsurf":
        likely = pathExists(join(homedir(), ".codeium", "windsurf"));
        break;
      case "trae":
        likely = pathExists(dirname(def.getConfigPath()));
        break;
      case "trae_cn":
        likely = pathExists(dirname(def.getConfigPath()));
        break;
      case "vscode":
      case "cline":
        likely =
          pathExists(macAppSupportDir("Code")) ||
          pathExists(appDataDir("Code")) ||
          pathExists(xdgConfigDir("Code"));
        break;
      case "opencode":
        likely = pathExists(xdgConfigDir("opencode"));
        break;
      case "continue":
        likely = pathExists(join(homedir(), ".continue"));
        break;
      case "zed":
        likely =
          pathExists(join(homedir(), ".config", "zed")) ||
          pathExists(appDataDir("Zed"));
        break;
      case "kiro":
        likely = pathExists(join(homedir(), ".kiro"));
        break;
      case "roocode":
        likely = pathExists(join(homedir(), ".roo"));
        break;
      case "amazonq":
        likely = pathExists(join(homedir(), ".aws", "amazonq"));
        break;
      case "copilot_cli":
        likely = pathExists(join(homedir(), ".copilot"));
        break;
      case "gemini":
        likely = pathExists(join(homedir(), ".gemini"));
        break;
      case "kimi":
        likely = pathExists(join(homedir(), ".kimi"));
        break;
      case "codex":
        likely = pathExists(join(homedir(), ".codex"));
        break;
      default:
        likely = false;
    }

    if (likely) detected.push(key);
  }

  return detected.length > 0 ? [...new Set(detected)] : ["cursor", "claude"];
}

export function loadExistingZentaoEnv() {
  const candidates = [
    join(homedir(), ".cursor", "mcp.json"),
    join(homedir(), ".claude.json"),
    PLATFORMS.claude.getConfigPath(),
    PLATFORMS.windsurf.getConfigPath(),
    join(homedir(), ".continue", "mcpServers", "mcp.json"),
  ];
  for (const path of candidates) {
    if (!existsSync(path)) continue;
    try {
      const json = JSON.parse(readFileSync(path, "utf8"));
      const env =
        json?.mcpServers?.[SERVER_NAME]?.env ??
        json?.servers?.[SERVER_NAME]?.env ??
        json?.mcp?.[SERVER_NAME]?.environment;
      if (env && typeof env === "object") return env;
    } catch {
      // ignore
    }
  }
  return {};
}

function ask(rl, question, defaultValue = "") {
  const suffix = defaultValue ? ` [${defaultValue}]` : "";
  return new Promise((resolvePrompt) => {
    rl.question(`${question}${suffix}: `, (answer) => {
      const value = answer.trim();
      resolvePrompt(value || defaultValue);
    });
  });
}

function askYesNo(rl, question, defaultYes = true) {
  const hint = defaultYes ? "Y/n" : "y/N";
  return new Promise((resolvePrompt) => {
    rl.question(`${question} (${hint}): `, (answer) => {
      const value = answer.trim().toLowerCase();
      if (!value) return resolvePrompt(defaultYes);
      resolvePrompt(value === "y" || value === "yes" || value === "true" || value === "1");
    });
  });
}

export async function collectCredentials(projectRoot, options = {}) {
  const installEnvFile = loadEnvInstallFile(projectRoot);
  const fileEnv = { ...loadEnvFile(projectRoot), ...installEnvFile.env };
  const existingEnv = loadExistingZentaoEnv();
  const merged = { ...existingEnv, ...fileEnv, ...options.env };

  if (options.nonInteractive) {
    const url = merged.ZENTAO_URL || process.env.ZENTAO_URL;
    const account = merged.ZENTAO_ACCOUNT || process.env.ZENTAO_ACCOUNT;
    const password = merged.ZENTAO_PASSWORD ?? process.env.ZENTAO_PASSWORD;
    if (!url || !account || password === undefined) {
      throw new Error(
        "Non-interactive mode requires ZENTAO_URL, ZENTAO_ACCOUNT, ZENTAO_PASSWORD in env or .env",
      );
    }
    return buildEnvConfig(merged, { url, account, password });
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    console.log("\n=== 禅道 MCP 配置 ===\n");
    const url = await ask(rl, "禅道地址 ZENTAO_URL", merged.ZENTAO_URL || "");
    const account = await ask(rl, "账号 ZENTAO_ACCOUNT", merged.ZENTAO_ACCOUNT || "");
    const password = await ask(
      rl,
      "密码 ZENTAO_PASSWORD",
      merged.ZENTAO_PASSWORD || "",
    );
    const skipSsl = await askYesNo(
      rl,
      "跳过 SSL 证书校验 ZENTAO_SKIP_SSL",
      String(merged.ZENTAO_SKIP_SSL ?? "true").toLowerCase() !== "false",
    );
    const allowResolve = await askYesNo(
      rl,
      "允许 AI 标记 Bug 已解决 ZENTAO_ALLOW_RESOLVE_BUG",
      String(merged.ZENTAO_ALLOW_RESOLVE_BUG ?? "false").toLowerCase() === "true",
    );
    return buildEnvConfig(merged, {
      url,
      account,
      password,
      skipSsl,
      allowResolve,
    });
  } finally {
    rl.close();
  }
}

function buildEnvConfig(base, overrides) {
  return {
    ZENTAO_URL: String(overrides.url ?? base.ZENTAO_URL ?? "").replace(/\/$/, ""),
    ZENTAO_ACCOUNT: String(overrides.account ?? base.ZENTAO_ACCOUNT ?? ""),
    ZENTAO_PASSWORD: String(overrides.password ?? base.ZENTAO_PASSWORD ?? ""),
    ZENTAO_SKIP_SSL: String(
      overrides.skipSsl ??
        (base.ZENTAO_SKIP_SSL ?? "true").toLowerCase() === "true",
    ),
    ZENTAO_ALLOW_RESOLVE_BUG: String(
      overrides.allowResolve ??
        (base.ZENTAO_ALLOW_RESOLVE_BUG ?? "false").toLowerCase() === "true",
    ),
    ZENTAO_ALLOW_CLOSE_BUG: String(
      (base.ZENTAO_ALLOW_CLOSE_BUG ?? "false").toLowerCase() === "true",
    ),
    ZENTAO_ALLOW_ACTIVATE_BUG: String(
      (base.ZENTAO_ALLOW_ACTIVATE_BUG ?? "false").toLowerCase() === "true",
    ),
  };
}

export function buildServerConfig(nodePath, entryPath, env, options = {}) {
  const config = {
    command: nodePath,
    args: [entryPath],
    env,
  };
  if (options.withStdioType || platform() === "win32") {
    config.type = "stdio";
  }
  return config;
}

export function parsePlatformSelection(raw, availableKeys) {
  if (!raw || raw === "all") return availableKeys;
  if (raw === "auto") {
    return detectInstalledPlatforms().filter((key) => availableKeys.includes(key));
  }
  return raw
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
    .filter((key) => availableKeys.includes(key));
}

export async function selectPlatforms(options = {}) {
  const availableKeys = Object.keys(PLATFORMS);
  if (options.platforms) {
    return parsePlatformSelection(options.platforms, availableKeys);
  }
  if (options.nonInteractive) {
    const fromEnv = process.env.INSTALL_PLATFORMS || process.env.ZENTAO_INSTALL_PLATFORMS;
    const selected = parsePlatformSelection(fromEnv || "auto", availableKeys);
    if (fromEnv === "auto" || (!fromEnv && selected.length > 0)) {
      console.log(`→ 自动检测 AI 平台: ${selected.join(", ")}`);
    }
    return selected;
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    console.log("\n可选 AI 平台：");
    for (const key of availableKeys) {
      console.log(`  - ${key}: ${PLATFORMS[key].label}`);
    }
    const answer = await ask(
      rl,
      "要安装到哪些平台（逗号分隔，all=全部）",
      "cursor,claude",
    );
    return parsePlatformSelection(answer, availableKeys);
  } finally {
    rl.close();
  }
}

export function readJsonFile(path) {
  if (!existsSync(path)) return {};
  const raw = readFileSync(path, "utf8").trim();
  if (!raw) return {};
  return JSON.parse(raw);
}

export function writeJsonFile(path, data) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function backupConfigFile(configPath) {
  const backupPath = `${configPath}.bak.${Date.now()}`;
  if (existsSync(configPath)) {
    copyFileSync(configPath, backupPath);
    return backupPath;
  }
  return null;
}

export function mergePlatformConfig(configPath, serversKey, serverName, serverConfig) {
  const backupPath = backupConfigFile(configPath);
  const root = readJsonFile(configPath);
  if (!root[serversKey] || typeof root[serversKey] !== "object") {
    root[serversKey] = {};
  }
  root[serversKey][serverName] = serverConfig;
  writeJsonFile(configPath, root);
  return { configPath, backupPath };
}

function mergeOpenCodeConfig(configPath, serverName, payload) {
  const backupPath = backupConfigFile(configPath);
  const root = readJsonFile(configPath);
  if (!root.mcp || typeof root.mcp !== "object") {
    root.mcp = {};
  }
  root.mcp[serverName] = {
    type: "local",
    command: [payload.nodePath, payload.entryPath],
    enabled: true,
    environment: payload.env,
  };
  writeJsonFile(configPath, root);
  return { configPath, backupPath };
}

function mergeZedConfig(configPath, serverName, payload) {
  const backupPath = backupConfigFile(configPath);
  const root = readJsonFile(configPath);
  if (!root.context_servers || typeof root.context_servers !== "object") {
    root.context_servers = {};
  }
  root.context_servers[serverName] = {
    command: payload.nodePath,
    args: [payload.entryPath],
    env: payload.env,
  };
  writeJsonFile(configPath, root);
  return { configPath, backupPath };
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function tomlString(value) {
  return JSON.stringify(String(value));
}

function mergeCodexTomlConfig(configPath, serverName, payload) {
  const backupPath = backupConfigFile(configPath);
  mkdirSync(dirname(configPath), { recursive: true });
  let content = existsSync(configPath) ? readFileSync(configPath, "utf8") : "";
  const blockRe = new RegExp(
    `\\n\\[mcp_servers\\.${escapeRegExp(serverName)}(?:\\.env)?\\][^\\[]*`,
    "g",
  );
  content = content.replace(blockRe, "");
  const lines = [
    "",
    `[mcp_servers.${serverName}]`,
    `command = ${tomlString(payload.nodePath)}`,
    `args = ${JSON.stringify([payload.entryPath])}`,
    "enabled = true",
    "",
    `[mcp_servers.${serverName}.env]`,
  ];
  for (const [key, value] of Object.entries(payload.env)) {
    lines.push(`${key} = ${tomlString(value)}`);
  }
  writeFileSync(configPath, `${content.trimEnd()}\n${lines.join("\n")}\n`, "utf8");
  return { configPath, backupPath };
}

export function applyPlatformConfig(platformKey, serverName, payload) {
  const platformDef = PLATFORMS[platformKey];
  if (!platformDef) {
    throw new Error(`Unknown platform: ${platformKey}`);
  }

  const serverConfig = buildServerConfig(payload.nodePath, payload.entryPath, payload.env, {
    withStdioType: platformDef.withStdioType,
  });
  const mergedPayload = { ...payload, config: serverConfig };
  const writes = [];

  for (const configPath of platformDef.getConfigPaths()) {
    if (platformDef.merge) {
      writes.push(platformDef.merge(configPath, serverName, mergedPayload));
    } else {
      writes.push(
        mergePlatformConfig(configPath, platformDef.serversKey, serverName, serverConfig),
      );
    }
  }

  return {
    key: platformKey,
    label: platformDef.label,
    configPath: writes.map((item) => item.configPath).join("; "),
    backupPath: writes.find((item) => item.backupPath)?.backupPath ?? null,
    writes,
  };
}

export function ensureBuilt(projectRoot) {
  const entryPath = resolveEntryPath(projectRoot);
  const pkgPath = join(projectRoot, "package.json");
  if (!existsSync(join(projectRoot, "node_modules")) && existsSync(pkgPath)) {
    return { entryPath, built: false, note: "node_modules missing; run npm install" };
  }
  return { entryPath, built: true };
}
