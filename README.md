# 禅道 Bug MCP

> 让 **Cursor / Claude / Windsurf** 等 AI 直接读禅道 Bug、按步骤修 Bug，修完后可选回写「已解决」。

适配禅道开源版 **16.5+ / 18.12** · REST API v1

---

## 30 秒：能干什么

| 你想… | 在 AI 里这样说 |
|--------|----------------|
| 确认装好了 | 「调用 zentao_health_check 检查禅道连接」 |
| 看我负责的 Bug | 「列出指派给我的 Bug，最新的 10 条」 |
| 读重现步骤修 Bug | 「读取 Bug #12345 详情，按 steps 帮我改代码」 |
| 查某产品下的 Bug | 「查产品 3 下 alice 的 active Bug」 |
| 修完回写禅道 | 「dryRun 预演把 #12345 标为 fixed，备注 xxx」（需开写权限） |

**一条命令安装，无需 clone：**

```bash
curl -fsSL https://raw.githubusercontent.com/ceeyang/zentao_mcp/main/install.sh | bash
```

Windows：`irm https://raw.githubusercontent.com/ceeyang/zentao_mcp/main/install.ps1 | iex`

装完 **重启 AI 客户端**，按上表开聊即可。更多示例 → [docs/FEATURES.zh-CN.md](docs/FEATURES.zh-CN.md)

---

## 已实现功能

### 安装与集成

- **一条命令**从 GitHub 下载、构建、写入 MCP 配置（`~/.local/share/zentao-mcp`）
- **交互安装**：现场输入禅道账号，或选「稍后配置」
- **18 种 AI 客户端**：Cursor、Claude Desktop、Claude Code、Windsurf、Trae、VS Code、Cline、OpenCode、Continue、Zed 等（`INSTALL_PLATFORMS=auto` 自动检测）
- **node 绝对路径**，避免 Cursor `spawn ENOENT`

### 读 Bug（默认开启）

| 工具 | 能力 |
|------|------|
| `zentao_list_my_bugs` | 指派给当前账号的 Bug（不用记产品 ID） |
| `zentao_list_bugs` | 按产品 / 项目 / 执行筛选 |
| `zentao_get_bug` | 详情 + **HTML 重现步骤转纯文本**（`stepsPlain`） |
| `zentao_health_check` | 连通性 + 写权限开关状态 |

### 写 Bug（默认关闭，防误操作）

| 工具 | 需环境变量 |
|------|------------|
| `zentao_resolve_bug` | `ZENTAO_ALLOW_RESOLVE_BUG=true` |
| `zentao_close_bug` | `ZENTAO_ALLOW_CLOSE_BUG=true` |
| `zentao_activate_bug` | `ZENTAO_ALLOW_ACTIVATE_BUG=true` |

均支持 **`dryRun: true`** 先预演。详见 [功能示例](docs/FEATURES.zh-CN.md#5-修完后标记已解决默认关闭)。

### 安全与运维

- 产品白名单 `ZENTAO_ALLOWED_PRODUCTS`
- 自签名 HTTPS `ZENTAO_SKIP_SSL`
- Token / 账号密码双模式，401 自动刷新
- 统一 JSON 响应信封，方便 AI 解析

### 尚未实现

- Bug **指派推送**、群 **每日汇总** 机器人（需另建服务，见 [讨论方向](docs/FEATURES.zh-CN.md#已实现-vs-未实现)）

---

## 对话示例

**Morning standup：**

```
你：我禅道上有哪些没关的 Bug？
AI：→ zentao_list_my_bugs → 返回 6 条列表

你：重点看 #12345，读步骤，在 src/auth 里找原因
AI：→ zentao_get_bug → 读 stepsPlain → 改代码
```

**修完回写（已开 ZENTAO_ALLOW_RESOLVE_BUG）：**

```
你：测试过了，把 #12345 标为 fixed，备注「修复 token 过期未刷新」
AI：→ zentao_resolve_bug(resolution=fixed, comment=...)
```

---

## 安装说明

1. 执行上方 `curl | bash`（或 PowerShell `irm ... | iex`）
2. 按提示填禅道地址 / 账号 / 密码（可跳过）
3. 选 AI 平台（直接回车 = `auto` 自动检测）
4. **完全重启** Cursor / Claude 等
5. 对话：`调用 zentao_health_check 检查连接`

**稍后配置账号** — 编辑 `~/.cursor/mcp.json` 等里的 `zentao.env`：

```json
"env": {
  "ZENTAO_URL": "https://your-zentao-host",
  "ZENTAO_ACCOUNT": "your_account",
  "ZENTAO_PASSWORD": "your_password",
  "ZENTAO_SKIP_SSL": "true"
}
```

[完整安装文档](docs/INSTALL.zh-CN.md) · [发给同事](docs/SHARE.md)

---

## 文档

| 文档 | 内容 |
|------|------|
| [FEATURES.zh-CN.md](docs/FEATURES.zh-CN.md) | **功能清单 + 每个工具的 AI 说法示例** |
| [INSTALL.zh-CN.md](docs/INSTALL.zh-CN.md) | 安装、平台列表、FAQ |
| [SHARE.md](docs/SHARE.md) | 复制给同事的一键安装文案 |

---

## 环境变量（摘要）

| 变量 | 说明 |
|------|------|
| `ZENTAO_URL` / `ZENTAO_ACCOUNT` / `ZENTAO_PASSWORD` | 禅道凭据 |
| `ZENTAO_SKIP_SSL` | 自签名证书 → `true` |
| `ZENTAO_ALLOW_RESOLVE_BUG` 等 | 写操作开关，默认 `false` |
| `ZENTAO_ALLOWED_PRODUCTS` | 可选，产品 ID 白名单 |
| `INSTALL_PLATFORMS` | 安装时：`auto` / `all` / `cursor,claude` |

完整列表：[.env.example](.env.example)

---

## 维护者

```bash
git clone https://github.com/ceeyang/zentao_mcp.git
cd zentao_mcp && npm install && npm run build && ./install.sh
npm run test:install    # E2E
npm run verify:github   # 检查 raw 安装链
npm run pack:release    # 离线 tgz
```

## License

MIT
