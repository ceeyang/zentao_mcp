# 发给同事 — GitHub 一键安装

## 复制这段给同事

**macOS / Linux：**

```bash
curl -fsSL https://raw.githubusercontent.com/ceeyang/zentao_mcp/main/install.sh | bash
```

**Windows（PowerShell）：**

```powershell
irm https://raw.githubusercontent.com/ceeyang/zentao_mcp/main/install.ps1 | iex
```

按提示输入禅道地址、账号、密码，选择 AI 平台（Cursor / Claude 等），完成后 **重启 AI 客户端**。

## 前提

- Node.js 18+
- 能访问 GitHub 与禅道服务器

## 非交互（IT 统一部署）

```bash
ZENTAO_URL=https://zentao.thregw.com \
ZENTAO_ACCOUNT=账号 \
ZENTAO_PASSWORD=密码 \
ZENTAO_SKIP_SSL=true \
INSTALL_PLATFORMS=cursor,claude \
curl -fsSL https://raw.githubusercontent.com/ceeyang/zentao_mcp/main/install.sh | bash -s -- --yes
```

## 链接说明

| 用途 | URL |
|------|-----|
| 安装脚本 (sh) | https://raw.githubusercontent.com/ceeyang/zentao_mcp/main/install.sh |
| 安装脚本 (ps1) | https://raw.githubusercontent.com/ceeyang/zentao_mcp/main/install.ps1 |
| 仓库首页 | https://github.com/ceeyang/zentao_mcp |

发布到新仓库后，更新 `repo.config.json` 中的 `github` 字段，上述 URL 会随之变化。

## 离线备选

无法访问 GitHub 时，维护者可发 `release/zentao-mcp-0.1.3.tgz`，同事解压后运行 `./install.sh`。
