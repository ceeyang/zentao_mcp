# 禅道 MCP

> 让 **Cursor / Claude / Windsurf** 等 AI 直接读写禅道的 **Bug / 需求(story) / 任务(task)**。

适配禅道开源版 **16.5+ / 18.12** · REST API v1

---

## 30 秒：能干什么

| 你想… | 在 AI 里这样说 |
|--------|----------------|
| 确认装好了 | 「调用 zentao_health_check 检查禅道连接」 |
| 看我负责的 Bug | 「列出指派给我的 Bug，最新的 10 条」 |
| 读重现步骤修 Bug | 「读取 Bug #12345 详情，按 steps 帮我改代码」 |
| 查某产品下的需求 | 「列出产品 3 下未关闭的需求」 |
| 提一个需求 | 「在产品 3 下建需求：标题 xxx，描述 yyy」（需开写权限） |
| 拆任务 / 报工 | 「在迭代 5 下给 alice 建开发任务，预计 4 小时」「把任务 #88 标完成，消耗 3 小时」 |
| 修完回写禅道 | 「dryRun 预演把 #12345 标为 fixed，备注 xxx」（需开写权限） |

### 安装方式一：npm（推荐）

在 AI 客户端的 MCP 配置里直接用 `npx`，无需 clone、无需构建：

```json
{
  "mcpServers": {
    "zentao": {
      "command": "npx",
      "args": ["-y", "@ceeyang/zentao-mcp"],
      "env": {
        "ZENTAO_URL": "https://your-zentao-host",
        "ZENTAO_ACCOUNT": "your_account",
        "ZENTAO_PASSWORD": "your_password"
      }
    }
  }
}
```

也可以全局装：`npm i -g @ceeyang/zentao-mcp`，然后把 `command` 换成 `zentao-mcp`、`args` 留空。

### 安装方式二：一条命令脚本安装

```bash
curl -fsSL https://raw.githubusercontent.com/ceeyang/zentao_mcp/main/install.sh | bash
```

Windows：`irm https://raw.githubusercontent.com/ceeyang/zentao_mcp/main/install.ps1 | iex`

会自动下载、构建，并写入检测到的 18 种 AI 客户端配置。

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

### 需求 story / 任务 task

先用 `zentao_list_scopes` 找 ID：建需求要**产品 ID**，建任务要**迭代(execution) ID**。

| 工具 | 能力 | 需环境变量 |
|------|------|------------|
| `zentao_list_scopes` | 列产品 / 项目 / 迭代，拿 ID | 只读 |
| `zentao_list_stories` | 按产品 / 项目 / 迭代列需求 | 只读 |
| `zentao_get_story` | 详情 + **描述/验收标准转纯文本**、关联任务与 Bug | 只读 |
| `zentao_create_story` | 提需求 | `ZENTAO_ALLOW_WRITE_STORY=true` |
| `zentao_update_story` | 改标题 / 优先级 / 分类 / 模块等 | 同上 |
| `zentao_change_story` | 改**描述 / 验收标准**（禅道单独版本化，会升版本号） | 同上 |
| `zentao_close_story` / `zentao_assign_story` | 关闭 / 指派 | 同上 |
| `zentao_list_tasks` | 列迭代下任务；不传 `executionId` 就是「我的任务」 | 只读 |
| `zentao_get_task` | 详情 + 描述纯文本 + 操作历史 | 只读 |
| `zentao_create_task` | 拆任务 | `ZENTAO_ALLOW_WRITE_TASK=true` |
| `zentao_update_task` | 改字段 | 同上 |
| `zentao_start_task` / `zentao_finish_task` | 开始 / 完成（报工） | 同上 |
| `zentao_close_task` / `zentao_assign_task` | 关闭 / 指派 | 同上 |

写操作同样支持 `dryRun: true`。

> 改需求描述请用 `zentao_change_story`——禅道把 `spec`/`verify` 和其它字段分开版本化，
> 普通更新接口不会改描述。另外 18.x 的 `PUT /stories/:id` 在需求没有评审人时会被禅道拒绝，
> 此时工具会返回 `REVIEWER_REQUIRED` 并提示补 `reviewer`。

### 安全与运维

- 产品白名单 `ZENTAO_ALLOWED_PRODUCTS`
- 自签名 HTTPS `ZENTAO_SKIP_SSL`
- Token / 账号密码双模式，401 自动刷新
- 统一 JSON 响应信封，方便 AI 解析

### 尚未实现

- Bug **指派推送**、群 **每日汇总** 机器人（需另建服务，见 [讨论方向](docs/FEATURES.zh-CN.md#已实现-vs-未实现)）
- 需求评审流程（`review` / `submitreview`）、任务批量创建

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
| [DEV-DOCKER.zh-CN.md](docs/DEV-DOCKER.zh-CN.md) | **本地 Docker 禅道**：起测试环境 + 跑端到端测试 |

---

## 环境变量（摘要）

| 变量 | 说明 |
|------|------|
| `ZENTAO_URL` / `ZENTAO_ACCOUNT` / `ZENTAO_PASSWORD` | 禅道凭据 |
| `ZENTAO_SKIP_SSL` | 自签名证书 → `true` |
| `ZENTAO_ALLOW_RESOLVE_BUG` / `_CLOSE_BUG` / `_ACTIVATE_BUG` | Bug 写操作开关，默认 `false` |
| `ZENTAO_ALLOW_WRITE_STORY` / `ZENTAO_ALLOW_WRITE_TASK` | 需求 / 任务写操作开关，默认 `false` |
| `ZENTAO_ALLOWED_PRODUCTS` | 可选，产品 ID 白名单 |
| `INSTALL_PLATFORMS` | 安装时：`auto` / `all` / `cursor,claude` |

完整列表：[.env.example](.env.example)

---

## 维护者

```bash
git clone https://github.com/ceeyang/zentao_mcp.git
cd zentao_mcp && npm install && npm run build && ./install.sh
npm run test:install     # 安装脚本 E2E
npm run test:story-task  # 需求/任务 E2E（需本地禅道，见 docs/DEV-DOCKER.zh-CN.md）
npm run verify:github    # 检查 raw 安装链
npm run pack:release     # 离线 tgz
npm publish              # 发布到 npm（@ceeyang/zentao-mcp）
```

## License

MIT
