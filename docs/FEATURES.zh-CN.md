# 功能说明与示例

本文档说明 **当前已实现** 的能力，并给出在 Cursor / Claude 等客户端里的**说法示例**。

适配禅道开源版 **16.5+ / 18.12**，REST API v1。

---

## 一句话

**装好后，用自然语言让 AI 查禅道 Bug、读重现步骤、修完代码后（可选）回写「已解决」。**

---

## 已实现 vs 未实现

| 状态 | 能力 |
|------|------|
| ✅ | 一条命令安装到 18 种 AI 客户端 |
| ✅ | 查「指派给我的 Bug」 |
| ✅ | 按产品/项目/执行列 Bug |
| ✅ | 读 Bug 详情（HTML 步骤 → 纯文本） |
| ✅ | 标记已解决 / 关闭 / 重新激活（默认关闭，需环境变量开启） |
| ✅ | 写操作 `dryRun` 预演 |
| ✅ | 自签名 HTTPS、产品白名单、Token 自动刷新 |
| ❌ | Bug 指派推送 / 群日报机器人（规划中，见 README） |

---

## 安装（已实现）

**无需 clone**，一条命令：

```bash
curl -fsSL https://raw.githubusercontent.com/ceeyang/zentao_mcp/main/install.sh | bash
```

脚本自动：下载 → `npm install` → 构建 → 询问禅道账号（可跳过）→ 检测 AI 客户端并写入 MCP 配置。

详见 [INSTALL.zh-CN.md](./INSTALL.zh-CN.md)。

---

## MCP 工具一览

| 工具 | 干什么 | 默认 |
|------|--------|------|
| `zentao_health_check` | 测连通、看写权限开关 | 只读 |
| `zentao_list_my_bugs` | 我负责的 Bug 列表 | 只读 |
| `zentao_list_bugs` | 按产品/项目/执行列 Bug | 只读 |
| `zentao_get_bug` | Bug 详情 + 纯文本重现步骤 | 只读 |
| `zentao_resolve_bug` | 标记已修复 | 需开关 |
| `zentao_close_bug` | 关闭 Bug | 需开关 |
| `zentao_activate_bug` | 重新激活 | 需开关 |

所有工具返回统一 JSON 信封：`{ ok, data, error, meta }`，便于 AI 解析。

---

## AI 对话示例

装完 MCP 并重启客户端后，**直接说人话**，AI 会调用对应工具。

### 1. 检查是否连通

**你说：**

> 调用 zentao_health_check，检查一下禅道 MCP 是否正常。

**会得到：** 禅道地址、是否认证成功、三个写操作开关是否开启。

---

### 2. 看我有哪些 Bug

**你说：**

> 列出指派给我的未关闭 Bug，按 id 倒序，最多 10 条。

**AI 调用：** `zentao_list_my_bugs`（`type=assignedTo`, `order=id_desc`, `limit=10`）

**返回示例（简化）：**

```json
{
  "ok": true,
  "data": {
    "total": 6,
    "items": [
      {
        "id": 12345,
        "title": "登录页超时",
        "status": "active",
        "severity": 2,
        "pri": 2,
        "assignedTo": "cee"
      }
    ]
  }
}
```

---

### 3. 读某个 Bug 的重现步骤（修 Bug 最常用）

**你说：**

> 读取 Bug #12345 的详情，把重现步骤整理成 checklist，帮我定位可能出问题的代码。

**AI 调用：** `zentao_get_bug`（`bugId=12345`）

**返回里包含：**

- `stepsPlain`：从禅道 HTML 转好的**纯文本步骤**（AI 可直接读）
- `title` / `status` / `severity` / 附件列表等

---

### 4. 按产品查团队的 Bug

**你说：**

> 查产品 ID 3 下指派给 alice 的 active Bug。

**AI 调用：** `zentao_list_bugs`

```json
{
  "scope": "product",
  "id": 3,
  "assignedTo": "alice",
  "status": "active"
}
```

也支持 `scope: "project" | "execution"`。

---

### 5. 修完后标记「已解决」（默认关闭）

写操作默认 **不会** 改禅道，防止 AI 误操作。开启方式：MCP 配置 `env` 里设：

```json
"ZENTAO_ALLOW_RESOLVE_BUG": "true"
```

**你说：**

> 我已在本地修好 Bug #12345，先 dryRun 预演，再真正标记为 fixed，备注「修复 OAuth 回调域名校验」。

**AI 调用：**

1. `zentao_resolve_bug` + `dryRun: true` → 只看将要提交什么  
2. 你确认后 → `dryRun: false` 真正提交  

```json
{
  "bugId": 12345,
  "resolution": "fixed",
  "resolvedBuild": "trunk",
  "comment": "修复 OAuth 回调域名校验"
}
```

`resolution` 可选：`fixed` / `duplicate` / `bydesign` / `external` / `notrepro` 等。

---

### 6. 关闭 / 重新激活

同样需开关：

| 环境变量 | 工具 |
|----------|------|
| `ZENTAO_ALLOW_CLOSE_BUG=true` | `zentao_close_bug` |
| `ZENTAO_ALLOW_ACTIVATE_BUG=true` | `zentao_activate_bug` |

**你说：**

> 测试通过，关闭 Bug #12345。  
> （或）回归失败，重新激活 #12345 并指派给 cee。

---

## 典型工作流（AI 修 Bug）

```
1. 「我有哪些 Bug？」           → list_my_bugs
2. 「读 #12345 详情和步骤」     → get_bug
3. AI 在仓库里改代码、跑测试
4. 「dryRun 预演标记已解决」     → resolve_bug (dryRun)
5. 「确认，正式提交」           → resolve_bug
```

---

## 安全与配置（已实现）

| 能力 | 说明 |
|------|------|
| 写操作门禁 | 默认全关，仅显式 `ZENTAO_ALLOW_*=true` 才写库 |
| dryRun | 写工具均支持，先预演再真提交 |
| 产品白名单 | `ZENTAO_ALLOWED_PRODUCTS=1,3` 限制 list/query 范围 |
| 自签名证书 | `ZENTAO_SKIP_SSL=true` |
| Token 模式 | 支持 `ZENTAO_TOKEN` 或 账号+密码（MD5/明文） |
| 401 刷新 | 自动重新取 Token |

完整环境变量见 [.env.example](../.env.example)。

---

## 支持的 AI 客户端（安装脚本已实现）

安装时 `auto` 自动检测本机已安装的客户端，或指定 `all` / 逗号列表。

`cursor` · `claude` · `claude_code` · `windsurf` · `trae` · `trae_cn` · `vscode` · `cline` · `opencode` · `continue` · `zed` · `kiro` · `roocode` · `amazonq` · `copilot_cli` · `gemini` · `kimi` · `codex`

---

## 维护者命令

```bash
npm run smoke              # 冒烟测试
npm run test:install       # 安装流程 E2E
npm run verify:github      # 检查 GitHub 一键安装 URL
npm run install:urls       # 打印安装命令
```
