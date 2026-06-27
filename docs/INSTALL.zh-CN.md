# 一键安装

## 全自动安装（推荐）

```bash
cp .env.install.example .env.install   # 填写禅道凭据
./auto-install.sh
```

网络安装：

```bash
ZENTAO_URL=... ZENTAO_ACCOUNT=... ZENTAO_PASSWORD=... \
  curl -fsSL https://raw.githubusercontent.com/ceeyang/zentao_mcp/main/auto-install.sh | bash
```

Windows：

```powershell
irm https://raw.githubusercontent.com/ceeyang/zentao_mcp/main/auto-install.ps1 | iex
```

`INSTALL_PLATFORMS=auto`（默认）会自动检测本机 AI 客户端；`all` 写入全部平台。

## GitHub 网络安装（交互式）

仓库发布到 GitHub 后，使用 **raw.githubusercontent.com** 绝对地址一键安装：

### macOS / Linux

```bash
curl -fsSL https://raw.githubusercontent.com/ceeyang/zentao_mcp/main/install.sh | bash
```

### 非交互

```bash
ZENTAO_URL=https://zentao.thregw.com \
ZENTAO_ACCOUNT=your_account \
ZENTAO_PASSWORD=your_password \
ZENTAO_SKIP_SSL=true \
INSTALL_PLATFORMS=cursor,claude \
curl -fsSL https://raw.githubusercontent.com/ceeyang/zentao_mcp/main/install.sh | bash -s -- --yes
```

### Windows PowerShell

```powershell
irm https://raw.githubusercontent.com/ceeyang/zentao_mcp/main/install.ps1 | iex
```

### Windows CMD

```cmd
curl -fsSL https://raw.githubusercontent.com/ceeyang/zentao_mcp/main/install.cmd -o %TEMP%\zentao-install.cmd && %TEMP%\zentao-install.cmd
```

## 安装过程

1. 从 `https://github.com/ceeyang/zentao_mcp` 下载 `main` 分支
2. 安装到 `~/.local/share/zentao-mcp`（可改 `ZENTAO_MCP_INSTALL_DIR`）
3. 执行 `npm install` + `npm run build`
4. 交互式配置禅道账号与 AI 平台
5. 写入 MCP 配置（使用 node 绝对路径，避免 `ENOENT`）

## 自定义仓库

若 fork 到其他 GitHub 仓库：

```bash
ZENTAO_MCP_REPO=your-org/zentao_mcp \
ZENTAO_MCP_BRANCH=main \
curl -fsSL https://raw.githubusercontent.com/your-org/zentao_mcp/main/install.sh | bash
```

或修改仓库根目录 [`repo.config.json`](../repo.config.json) 后重新发布。

## 本地安装（已 clone 仓库）

```bash
./install.sh
install.cmd          # Windows
./install.sh --show-urls
```

## 支持的平台

| 平台 ID | 客户端 | 配置路径（主） |
|---------|--------|----------------|
| `cursor` | Cursor | `~/.cursor/mcp.json`（Windows 另写 `%APPDATA%\Cursor\mcp.json`） |
| `claude` | Claude Desktop | OS 对应 `claude_desktop_config.json` |
| `claude_code` | Claude Code CLI | `~/.claude.json` |
| `windsurf` | Windsurf | `~/.codeium/windsurf/mcp_config.json` |
| `trae` | Trae | `~/Library/Application Support/Trae/User/mcp.json` 等 |
| `trae_cn` | Trae CN | `~/Library/Application Support/Trae CN/User/mcp.json` 等 |
| `vscode` | VS Code Copilot MCP | `Code/User/mcp.json`（键名 `servers`） |
| `cline` | Cline 插件 | VS Code globalStorage + `~/.cline/...`（多路径） |
| `opencode` | OpenCode | `~/.config/opencode/opencode.json`（键名 `mcp`） |
| `continue` | Continue | `~/.continue/mcpServers/mcp.json` |
| `zed` | Zed | `~/.config/zed/settings.json`（键名 `context_servers`） |
| `kiro` | Kiro | `~/.kiro/mcp.json` |
| `roocode` | Roo Code | `~/.roo/mcp.json` |
| `amazonq` | Amazon Q Developer | `~/.aws/amazonq/mcp.json` |
| `copilot_cli` | GitHub Copilot CLI | `~/.copilot/mcp-config.json` |
| `gemini` | Gemini CLI | `~/.gemini/settings.json` |
| `kimi` | Kimi CLI | `~/.kimi/mcp.json` |
| `codex` | OpenAI Codex CLI | `~/.codex/config.toml`（TOML `[mcp_servers.*]`） |

**尚未自动安装（需手动配置）：**

- 项目级 `.vscode/mcp.json` / `.mcp.json`（Claude Code 项目 scope）
- JetBrains AI Assistant / `.idea/mcp.json`
- Google Antigravity 等较新客户端

```bash
./install.sh --list-platforms
```

## 安装后

1. **完全重启** AI 客户端
2. 对话测试：`调用 zentao_health_check 检查连接`
3. 自检：`npm run smoke`（在安装目录内）

## 常见问题

### spawn zentao-mcp ENOENT

安装脚本已自动使用 `node` 绝对路径，不要手动改回 `"command": "zentao-mcp"`。

### curl 下载失败

- 确认仓库已 push 到 GitHub 且分支为 `main`
- 内网环境可改用本地 `./install.sh` 或离线 tgz

### 修改 GitHub 地址

维护者编辑 `repo.config.json`：

```json
{
  "github": "ceeyang/zentao_mcp",
  "branch": "main",
  "installDir": "~/.local/share/zentao-mcp"
}
```
