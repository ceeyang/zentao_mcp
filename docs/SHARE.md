# 发给同事 — 一键安装 + 能干什么

## 复制安装命令

**macOS / Linux：**

```bash
curl -fsSL https://raw.githubusercontent.com/ceeyang/zentao_mcp/main/install.sh | bash
```

**Windows（PowerShell）：**

```powershell
irm https://raw.githubusercontent.com/ceeyang/zentao_mcp/main/install.ps1 | iex
```

- 无需 clone 仓库，脚本自动下载安装  
- 按提示输入禅道账号（也可稍后配置）  
- 装完 **重启 Cursor / Claude**，开聊即可  

---

## 装完能干什么（30 秒版）

| 场景 | 在 AI 里这样说 |
|------|----------------|
| 检查连接 | 「调用 zentao_health_check」 |
| 我的 Bug | 「列出指派给我的 Bug」 |
| 修某个 Bug | 「读 Bug #12345 详情，按重现步骤帮我改代码」 |
| 修完回写 | 「把 #12345 标为已解决，备注 xxx」（需管理员开写权限） |

详细示例：[FEATURES.zh-CN.md](./FEATURES.zh-CN.md)

---

## 前提

- Node.js 18+
- 能访问 GitHub 与禅道服务器
- 一个普通禅道账号（不必管理员）

---

## 链接

| 用途 | URL |
|------|-----|
| 安装脚本 (sh) | https://raw.githubusercontent.com/ceeyang/zentao_mcp/main/install.sh |
| 安装脚本 (ps1) | https://raw.githubusercontent.com/ceeyang/zentao_mcp/main/install.ps1 |
| 仓库 | https://github.com/ceeyang/zentao_mcp |
| 功能说明 | https://github.com/ceeyang/zentao_mcp/blob/main/docs/FEATURES.zh-CN.md |

---

## IT 批量部署（可选）

```bash
ZENTAO_URL=https://zentao.example.com \
ZENTAO_ACCOUNT=bot \
ZENTAO_PASSWORD=secret \
ZENTAO_SKIP_SSL=true \
INSTALL_PLATFORMS=auto \
curl -fsSL https://raw.githubusercontent.com/ceeyang/zentao_mcp/main/install.sh | bash -s -- --yes
```
