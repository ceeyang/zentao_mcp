# 禅道 Bug MCP

面向 AI 修 Bug 场景的禅道 MCP Server。通过 Cursor / Claude 等 MCP 客户端，读取禅道 Bug、获取 AI 友好的重现步骤摘要，并在修复完成后受控回写禅道状态。

适配 **禅道开源版 16.5+ / 18.12**，REST API v1：`${ZENTAO_URL}/api.php/v1`。

## 全自动安装（推荐）

**零交互**：自动检测本机 AI 客户端、安装依赖、构建、写入 MCP 配置。

### 步骤 1：准备凭据文件

```bash
cp .env.install.example .env.install
# 编辑 .env.install，填写 ZENTAO_URL / ZENTAO_ACCOUNT / ZENTAO_PASSWORD
```

> `.env.install` 已在 `.gitignore` 中，**不会**被 git 提交。

### 步骤 2：执行安装

**本地（已 clone）：**

```bash
chmod +x auto-install.sh
./auto-install.sh
```

**GitHub 网络安装（同事无需 clone）：**

```bash
# 方式 A：先在本机写好 .env.install 再 curl（适合内网分发文件）
curl -fsSL https://raw.githubusercontent.com/ceeyang/zentao_mcp/main/auto-install.sh | bash

# 方式 B：inline 环境变量（CI / 批量部署）
ZENTAO_URL=https://zentao.thregw.com \
ZENTAO_ACCOUNT=your_account \
ZENTAO_PASSWORD=your_password \
ZENTAO_SKIP_SSL=true \
INSTALL_PLATFORMS=auto \
curl -fsSL https://raw.githubusercontent.com/ceeyang/zentao_mcp/main/auto-install.sh | bash
```

**Windows PowerShell：**

```powershell
# 复制 .env.install.example → .env.install 并填写后
irm https://raw.githubusercontent.com/ceeyang/zentao_mcp/main/auto-install.ps1 | iex
```

### 平台选择

| `INSTALL_PLATFORMS` | 行为 |
|---------------------|------|
| `auto`（默认） | 检测本机已安装的 AI 客户端 |
| `all` | 写入全部 18 个平台 |
| `cursor,claude` | 指定平台，逗号分隔 |

查看检测结果：

```bash
node scripts/install.mjs --detect-platforms
# 或
./install.sh --list-platforms
```

### 安装后

1. **完全重启** 对应 AI 客户端
2. 对话测试：`调用 zentao_health_check 检查禅道连接`
3. 自检：`npm run smoke`（在安装目录内）

---

## 交互式安装

需要逐步选择平台、现场输入账号时使用：

```bash
./install.sh
# 或网络: curl -fsSL .../install.sh | bash
```

查看所有安装命令：

```bash
npm run install:urls
```

修改 GitHub 仓库地址：编辑 [`repo.config.json`](repo.config.json) 或设置 `ZENTAO_MCP_REPO`、`ZENTAO_MCP_BRANCH`。

### 发布前自检（维护者）

```bash
npm run test:install    # 本地 E2E：npm install + build + install 脚本
npm run verify:github   # 检查 GitHub raw 是否可访问（push 后应全部 ✓）
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

安装时可多选（`all` = 全部），详见 [docs/INSTALL.zh-CN.md](docs/INSTALL.zh-CN.md)。

## 本地开发 / 维护者

```bash
git clone https://github.com/ceeyang/zentao_mcp.git
cd zentao_mcp
npm install
npm run build
./auto-install.sh          # 全自动
# 或 ./install.sh          # 交互式
```

打包离线安装包（可选）：

```bash
npm run pack:release
# → release/zentao-mcp-0.1.3.tgz
```

## 环境变量

| 变量 | 说明 |
|------|------|
| `ZENTAO_URL` | 禅道地址 |
| `ZENTAO_ACCOUNT` / `ZENTAO_PASSWORD` | 登录凭据 |
| `ZENTAO_SKIP_SSL` | 自签名证书设为 `true` |
| `ZENTAO_ALLOW_RESOLVE_BUG` | 允许 AI 标记已修复 |
| `ZENTAO_MCP_REPO` | GitHub 仓库，默认 `ceeyang/zentao_mcp` |
| `ZENTAO_MCP_BRANCH` | 分支，默认 `main` |
| `INSTALL_PLATFORMS` | `auto` / `all` / 逗号列表 |
| `ZENTAO_ENV_FILE` | 凭据文件路径，默认 `.env.install` |
| `ZENTAO_NODE_PATH` | 指定 node 绝对路径 |

## 脚本一览

| 脚本 | 用途 |
|------|------|
| `auto-install.sh` / `auto-install.ps1` | **全自动**安装（推荐） |
| `install.sh` / `install.ps1` / `install.cmd` | 交互式 / 半自动安装 |
| `scripts/install.mjs` | 核心安装逻辑 |
| `.env.install.example` | 凭据模板（复制为 `.env.install`） |

## License

MIT
