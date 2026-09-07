# 本地 Docker 禅道：开发与测试环境

用于在本机跑起一套**一次性**禅道，验证 MCP 工具是否真的能读写 Bug / 需求 / 任务。

推荐用 **18.12**（本仓库主要适配版本）。22.x 见文末「版本差异」。

---

## 1. 启动禅道 18.12

禅道镜像**不自带数据库**，需要单独跑一个 MySQL/MariaDB，并放在同一个 docker 网络里。

```bash
docker network create zentao-net

docker run -d --name zentao18-db --network zentao-net \
  -e MARIADB_ROOT_PASSWORD=123456 -e MARIADB_DATABASE=zentao \
  mariadb:10.6 --max_allowed_packet=64M

# 等数据库就绪
until docker exec zentao18-db mariadb -uroot -p123456 -e "SELECT 1" >/dev/null 2>&1; do sleep 2; done

docker run -d --name zentao18 --network zentao-net -p 8812:80 \
  -e MYSQL_HOST=zentao18-db -e MYSQL_PORT=3306 -e MYSQL_USER=root \
  -e MYSQL_PASSWORD=123456 -e MYSQL_DB=zentao \
  easysoft/zentao:18.12

# 等 HTTP 起来（会 302 到 /install.php）
until curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8812/ | grep -qE "^(200|301|302)$"; do sleep 3; done
```

---

## 2. 命令行走完安装向导

> **关键点：必须带 `Referer` 头。**
> 禅道的 CSRF 防护会把不带合法 Referer 的请求的 `$_POST` 直接清空
> （`framework/base/router.class.php`：`... or !str_starts_with($this->server->http_referer, "$httpType://$httpHost")) $_FILES = $_POST = array();`），
> 表现为「POST 了但页面又回到了表单」，不会有任何报错。

```bash
B=http://127.0.0.1:8812
C=/tmp/zt18.cookie; rm -f $C
CURL="curl -s -c $C -b $C -e $B/"

# 1) 同意协议
$CURL "$B/install.php" -o /dev/null
$CURL -X POST "$B/install.php?m=install&f=step1" -d "agree=yes" -o /dev/null

# 2) 数据库配置 + 生成 my.php（18.x 的 db 表单提交到 step3）
$CURL -X POST "$B/install.php?m=install&f=step3" \
  -d "dbDriver=mysql&dbHost=zentao18-db&dbPort=3306&dbName=zentao&dbUser=root&dbPassword=123456&dbEncoding=utf8mb4&clearDB=0&timezone=Asia/Shanghai&defaultLang=zh-cn" \
  -o /dev/null

# 3) 使用模式
$CURL -X POST "$B/install.php?m=install&f=step4" -d "mode=classic" -o /dev/null

# 4) 建管理员 + 导入演示数据（产品/项目/迭代/需求/任务/Bug 都有）
$CURL -X POST "$B/install.php?m=install&f=step5" \
  -d "company=TestCo&account=admin&password=Zentao%40123456&flow=full&importDemoData=1" -o /dev/null

# 5) 完成
$CURL "$B/install.php?m=install&f=step6" -o /dev/null
```

验证 REST API：

```bash
curl -s -X POST http://127.0.0.1:8812/api.php/v1/tokens \
  -H "Content-Type: application/json" \
  -d '{"account":"admin","password":"Zentao@123456"}'
# => {"token":"..."}
```

演示数据大致长这样：产品 `1`、迭代 `1` / `2`、需求 `1..7`、任务 `10..17`。

---

## 3. 跑 MCP 端到端测试

```bash
npm install && npm run build

ZENTAO_URL=http://127.0.0.1:8812 \
ZENTAO_ACCOUNT=admin \
ZENTAO_PASSWORD='Zentao@123456' \
npm run test:story-task
```

覆盖：工具注册、健康检查、产品/迭代发现、需求增删改查（含 `change` 改描述）、
任务全生命周期（建 → 改 → 开始 → 完成 → 关闭）、以及**写开关默认关闭**的验证。

只测 Bug 相关：

```bash
ZENTAO_URL=http://127.0.0.1:8812 ZENTAO_ACCOUNT=admin \
ZENTAO_PASSWORD='Zentao@123456' npm run smoke
```

---

## 4. 清理

```bash
docker rm -f zentao18 zentao18-db
docker network rm zentao-net
```

---

## 版本差异

| 版本 | 情况 |
|------|------|
| **18.12** | ✅ 需求 / 任务 REST 接口均正常，推荐用它验证 |
| 22.5 (`latest`) | ⚠️ `/executions`、`/tasks/:id` 等接口会返回 **HTTP 200 + 空 body**；安装向导也换成了 zin 前端（step2 收 db 配置、需轮询 `ajaxCreateTable` 建表） |

另外两个 18.x 的接口限制，代码里已经处理：

- `PUT /stories/:id` 在**需求没有评审人**时会报『评审人员』不能为空。
  18.x 的 `api/v1/entries/story.php` 白名单里没有 `needNotReview`，没法绕过，
  所以 `zentao_update_story` 会返回 `REVIEWER_REQUIRED`，提示改传 `reviewer`，
  或改用 `zentao_change_story` 改描述。
- `POST /tasks/:id/finish` 必须带 `currentConsumed`、`realStarted`、`finishedDate`，
  后两个工具层会默认填当前时间（禅道要 `YYYY-MM-DD HH:mm:ss`，不是 ISO-8601）。
