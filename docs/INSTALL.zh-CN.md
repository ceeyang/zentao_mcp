# 一键安装

> 功能与 AI 对话示例见 **[FEATURES.zh-CN.md](./FEATURES.zh-CN.md)**

## 一条命令（推荐）

**无需 clone**，脚本从 GitHub 下载并交互配置：

```bash
curl -fsSL https://raw.githubusercontent.com/ceeyang/zentao_mcp/main/install.sh | bash
```

Windows：

```powershell
irm https://raw.githubusercontent.com/ceeyang/zentao_mcp/main/install.ps1 | iex
```

### 安装时会问什么

1. **是否现在配置禅道账号** — 选「否」可先装好 MCP，稍后在配置文件 `env` 里填写
2. **禅道地址 / 账号 / 密码** — 选「是」时填写
3. **安装到哪些 AI 平台** — 默认 `auto` 自动检测本机客户端

### 稍后配置账号

编辑 MCP 配置中 `zentao` 节点的 `env`，例如 Cursor 的 `~/.cursor/mcp.json`：

```json
"zentao": {
  "command": "/path/to/node",
  "args": ["/path/to/.local/share/zentao-mcp/dist/index.js"],
  "env": {
    "ZENTAO_URL": "https://your-zentao-host",
    "ZENTAO_ACCOUNT": "your_account",
    "ZENTAO_PASSWORD": "your_password",
    "ZENTAO_SKIP_SSL": "true"
  }
}
```

## 安装过程（自动完成）

1. 下载到 `~/.local/share/zentao-mcp`
2. `npm install` + `npm run build`
3. 写入所选 AI 平台的 MCP 配置（使用 node 绝对路径）

## CI / 批量（非交互）

```bash
ZENTAO_URL=... ZENTAO_ACCOUNT=... ZENTAO_PASSWORD=... \
  curl -fsSL https://raw.githubusercontent.com/ceeyang/zentao_mcp/main/install.sh | bash -s -- --yes
```

跳过账号、稍后手动配置：

```bash
curl -fsSL https://raw.githubusercontent.com/ceeyang/zentao_mcp/main/install.sh | bash -s -- --yes --skip-credentials
```

## 支持的平台

| 平台 ID | 客户端 |
|---------|--------|
| `cursor` | Cursor |
| `claude` | Claude Desktop |
| `claude_code` | Claude Code CLI |
| `windsurf` | Windsurf |
| `trae` / `trae_cn` | Trae / Trae CN |
| `vscode` | VS Code Copilot MCP |
| `cline` | Cline |
| `opencode` | OpenCode |
| `continue` | Continue |
| `zed` | Zed |
| `kiro` | Kiro |
| `roocode` | Roo Code |
| `amazonq` | Amazon Q |
| `copilot_cli` | GitHub Copilot CLI |
| `gemini` | Gemini CLI |
| `kimi` | Kimi CLI |
| `codex` | OpenAI Codex CLI |

```bash
curl -fsSL .../install.sh | bash -s -- --list-platforms   # 需本地有脚本时
node scripts/install.mjs --detect-platforms               # 维护者
```

## 常见问题

### spawn zentao-mcp ENOENT

安装脚本已使用 `node` 绝对路径，勿改回 `"command": "zentao-mcp"`。

### curl 404

确认仓库已 push：`npm run verify:github`
