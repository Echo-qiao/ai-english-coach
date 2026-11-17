# AI 英语写作批改

提交一段英语作文，几秒内流式返回逐句批改和评分。

**技术栈**：Vue3 + TypeScript + Pinia + Vite ｜ Express + TypeScript + Prisma + MySQL ｜ pnpm ｜ Docker Compose

## 功能

- **注册 / 登录**：bcrypt 哈希存储密码，JWT 签发与校验，401 统一处理并跳转登录
- **SSE 流式批改**：逐字推送，15s 心跳保活，客户端断开时中断上游请求，不继续消耗额度
- **历史记录**：游标分页（避免深分页扫描），`(userId, createdAt)` 联合索引
- **越权防护**：详情查询同时带 `id` 和 `userId`，查不到统一返回 404，不泄露资源是否存在
- **参数校验**：zod 校验请求体，统一错误中间件按错误类型返回对应状态码
- **无 Key 可运行**：未配置模型 API Key 时自动降级为模拟流式输出，行为和真实流式一致

## 目录结构

```
ai-english-coach/
├── client/                       # 前端
│   ├── src/api/http.ts           # axios 实例：token 注入、401 跳转
│   ├── src/api/index.ts          # 接口封装 + SSE 帧解析
│   ├── src/stores/user.ts        # Pinia 登录态
│   ├── src/router/index.ts       # 路由 + 守卫
│   ├── src/views/                # 登录 / 练习 / 历史
│   ├── Dockerfile                # 构建静态文件 + Nginx 托管
│   └── nginx.conf                # 反代 /api，关闭缓冲
├── server/                       # 后端
│   ├── prisma/schema.prisma      # 数据模型
│   ├── Dockerfile                # 三阶段构建
│   ├── docker-entrypoint.sh      # 启动时同步表结构后 exec node
│   └── src/
│       ├── routes/               # 参数校验 + 响应
│       ├── services/             # 业务逻辑
│       ├── middlewares/          # 鉴权、统一错误
│       └── lib/                  # prisma / jwt / llm（流式）
├── docker-compose.yml            # MySQL + API + Nginx
└── README.md
```

## 快速开始

### 环境要求

- Node.js ≥ 18
- pnpm（`npm i -g pnpm`）
- MySQL 8，或直接用 Docker

### 1. 数据库

**用本机 MySQL**：新建库即可

```sql
CREATE DATABASE ai_english_coach DEFAULT CHARACTER SET utf8mb4;
```

**用 Docker**：见下文第 5 节。

两种方式都要让 `server/.env` 里的 `DATABASE_URL` 对上。**密码只允许字母数字**——它会被原样拼进连接串，含 `@ : / ? #` 必须写成百分号编码，否则连接串被截断。

### 2. 后端

```bash
cd server
pnpm install
cp .env.example .env     # 填 DATABASE_URL 和 JWT_SECRET
pnpm db:push             # 建表
pnpm dev                 # http://127.0.0.1:3000
```

访问 <http://127.0.0.1:3000/health>，返回 `{"ok":true,"mock":true}` 即为正常。

### 3. 前端

```bash
cd client
pnpm install
pnpm dev                 # http://127.0.0.1:5173
```

### 4. 接入真实模型（可选）

在 `server/.env` 中填写：

```ini
OPENAI_API_KEY="sk-xxxx"
OPENAI_BASE_URL="https://api.deepseek.com/v1"
OPENAI_MODEL="deepseek-chat"
```

重启后 `/health` 里的 `mock` 会变为 `false`。

### 5. 用 Docker 一键启动

```bash
cp .env.example .env      # 配置根目录 .env
docker compose up -d --build
docker compose ps         # 三个容器都应为 running，mysql / api 为 healthy
```

| 地址 | 说明 |
| --- | --- |
| <http://localhost:8080> | 前端入口（Nginx） |
| <http://localhost:3000/health> | 后端直连 |
| `127.0.0.1:3307` | 容器内 MySQL 映射到宿主的端口 |
| `docker compose logs -f api` | 查看后端日志 |
| `docker compose down -v` | 停止并清空数据卷（会删库） |

## 接口

| 方法 | 路径 | 鉴权 | 说明 |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | 否 | 注册，返回 token |
| POST | `/api/auth/login` | 否 | 登录，返回 token |
| POST | `/api/practice/stream` | 是 | SSE 流式批改 |
| GET | `/api/records?cursor=&limit=` | 是 | 历史列表（游标分页） |
| GET | `/api/records/:id` | 是 | 详情（带归属校验） |
| GET | `/health` | 否 | 健康检查 |

**SSE 事件格式**

```
data: {"delta":"## 总评"}\n\n
data: {"delta":"\n这是一篇…"}\n\n
event: done
data: {"recordId":"clx…","score":78}\n\n
```

出错时发送 `event: error`，前端单独处理。

## 设计取舍

**为什么用 SSE 而不是 WebSocket**：批改是单向下行、一次性消费的场景，SSE 基于 HTTP，更简单，也能直接复用现有的代理和鉴权设施；WebSocket 适合双向通信。

**怎么处理拆包**：每条事件以 `\n\n` 结尾，前端用 buffer 累积、按 `\n\n` 切帧，不完整的半个事件留到下一次 `read()`，避免多字节中文被截断。

**用户中途关页面**：监听 `res` 的 `close`（不是 `req`，`req` 的 `close` 在请求体读完就会触发），用 `writableEnded` 区分正常结束和提前断开，提前断开则 `abort()` 上游请求。

**分页为什么用游标**：`offset` 在深分页时要扫描并丢弃前 N 行，游标直接定位到上一页最后一条，配合联合索引稳定在 O(log n)。

**为什么分层**：路由只负责参数校验和响应，业务逻辑集中在 service，换框架或加缓存时不用改路由。

**为什么用 pnpm**：硬链接复用同一份依赖，安装快、占用小；`node_modules` 结构严格，只能访问声明过的依赖，不会出现幽灵依赖；`pnpm-lock.yaml` 保证依赖树一致。

**Docker 多阶段构建**：`deps → build → runtime` 三层分离，最终镜像只包含 `dist` 和运行时依赖，不带源码和构建工具。

**Nginx 反代 SSE 的坑**：必须 `proxy_buffering off`，否则 Nginx 会把流攒成一块再发，前端看到的就不是逐字输出。后端同时设置 `X-Accel-Buffering: no` 双保险。

## 常见问题

**`prisma migrate dev` 报 P1001**
数据库连不上。检查 MySQL 是否启动、端口是否为 3306、密码是否需要百分号编码。

**`prisma migrate dev` 报 P3014 / 无权限创建 shadow database**
用 root 账号，或手动 `CREATE DATABASE ai_english_coach;` 后改用 `pnpm db:push`。

**前端请求 404 / 跨域**
确认后端在 3000、前端在 5173，并且请求走 Vite 代理（`/api` 开头）。

**流式输出一次性全出来**
被代理缓冲了。后端已设置 `X-Accel-Buffering: no`；如果用了 Nginx，还需要 `proxy_buffering off;`。

**`docker pull` 一直卡住**
国内直连 Docker Hub 不通，而 dockerd 在 WSL2 中运行、不会使用 Windows 的系统代理。在 `~/.docker/daemon.json` 配置 `registry-mirrors` 后重启 Docker Desktop。不要配置 `http://host.docker.internal:xxx` 形式的代理，WSL2 中该域名可能无法解析，会把所有拉取堵死。
