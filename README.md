# 禅道 Bug MCP

面向 AI 修 Bug 场景的禅道 MCP Server。通过 Cursor / Claude 等 MCP 客户端，读取禅道 Bug、获取 AI 友好的重现步骤摘要，并在修复完成后受控回写禅道状态。

适配 **禅道开源版 16.5+ / 18.12**，REST API v1：`${ZENTAO_URL}/api.php/v1`。

## 一键安装

**无需 clone 仓库**，复制一条命令执行即可。脚本会自动从 GitHub 下载、安装依赖、构建，并**交互式**询问禅道账号与 AI 平台；也可选择「稍后配置」账号。

**macOS / Linux：**

```bash
curl -fsSL https://raw.githubusercontent.com/ceeyang/zentao_mcp/main/install.sh | bash
```

**Windows PowerShell：**

```powershell
irm https://raw.githubusercontent.com/ceeyang/zentao_mcp/main/install.ps1 | iex
```

安装过程：

1. 下载到 `~/.local/share/zentao-mcp`（Windows：`%LOCALAPPDATA%\zentao-mcp`）
2. 自动 `npm install` + 构建
3. 询问禅道地址 / 账号 / 密码（可跳过，稍后在 MCP 配置的 `env` 里填写）
4. 自动检测本机 AI 客户端并写入 MCP 配置

安装完成后**重启 AI 客户端**，对话测试：`调用 zentao_health_check 检查禅道连接`

查看安装命令：`npm run install:urls`

### 稍后配置禅道账号

安装时选「否」跳过账号，或安装完成后编辑 MCP 配置文件里 `zentao` 的 `env`：

```json
"env": {
  "ZENTAO_URL": "https://your-zentao-host",
  "ZENTAO_ACCOUNT": "your_account",
  "ZENTAO_PASSWORD": "your_password",
  "ZENTAO_SKIP_SSL": "true"
}
```

常见路径：`~/.cursor/mcp.json`（Cursor）、Claude Desktop 的 `claude_desktop_config.json` 等。

### CI / 批量部署（可选）

```bash
ZENTAO_URL=https://zentao.example.com \
ZENTAO_ACCOUNT=bot \
ZENTAO_PASSWORD=secret \
curl -fsSL https://raw.githubusercontent.com/ceeyang/zentao_mcp/main/install.sh | bash -s -- --yes
```

## 功能

| Tool | 说明 | 默认权限 |
|------|------|----------|
| `zentao_health_check` | 检查配置、认证、写操作开关 | 只读 |
| `zentao_list_my_bugs` | 查询指派给当前用户的 Bug | 只读 |
| `zentao_list_bugs` | 按产品/项目/执行列 Bug | 只读 |
| `zentao_get_bug` | Bug 详情 + HTML 步骤转纯文本 | 只读 |
| `zentao_resolve_bug` | 标记已修复 | 需开关 |
| `zentao_close_bug` | 关闭 Bug | 需开关 |
| `zentao_activate_bug` | 重新激活 Bug | 需开关 |

## 支持的 AI 平台

`cursor` · `claude` · `claude_code` · `windsurf` · `trae` · `trae_cn` · `vscode` · `cline` · `opencode` · `continue` · `zed` · `kiro` · `roocode` · `amazonq` · `copilot_cli` · `gemini` · `kimi` · `codex`

安装时默认 `auto` 自动检测，详见 [docs/INSTALL.zh-CN.md](docs/INSTALL.zh-CN.md)。

## 维护者

```bash
git clone https://github.com/ceeyang/zentao_mcp.git
cd zentao_mcp
npm install && npm run build
./install.sh
```

```bash
npm run test:install     # 本地 E2E
npm run verify:github    # 检查 GitHub raw 是否可访问
npm run pack:release     # 离线 tgz 包
```

## 环境变量

| 变量 | 说明 |
|------|------|
| `ZENTAO_URL` / `ZENTAO_ACCOUNT` / `ZENTAO_PASSWORD` | 禅道凭据（安装时输入或写入 MCP env） |
| `ZENTAO_SKIP_SSL` | 自签名证书设为 `true` |
| `INSTALL_PLATFORMS` | `auto` / `all` / 逗号列表（非交互 `--yes` 时用） |
| `ZENTAO_MCP_REPO` | GitHub 仓库，默认 `ceeyang/zentao_mcp` |
| `ZENTAO_NODE_PATH` | 指定 node 绝对路径 |

## License

MIT
