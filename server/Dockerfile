# syntax=docker/dockerfile:1
#
# 后端镜像：三阶段构建
#   deps    → 只装依赖（lockfile 变了才重装）
#   build   → 生成 Prisma Client + tsc 编译
#   runtime → 只留 dist / prisma / node_modules，不带源码和 tsconfig
#
# 构建：docker build -t coach-api ./server

ARG NODE_VERSION=22
ARG PNPM_VERSION=10

# ── ① 依赖层 ────────────────────────────────────────────────
FROM node:${NODE_VERSION}-alpine AS deps
WORKDIR /app
ARG PNPM_VERSION
# Prisma 在 musl（alpine）上靠 openssl 判断该用哪个查询引擎，
# 镜像里没有 openssl 时会报「找不到 query engine」，所以必须先装。
RUN apk add --no-cache openssl libc6-compat
RUN npm i -g pnpm@${PNPM_VERSION}
# 只拷清单文件：改业务代码不会让这一层缓存失效
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# ── ② 编译层 ────────────────────────────────────────────────
FROM node:${NODE_VERSION}-alpine AS build
WORKDIR /app
ARG PNPM_VERSION
RUN apk add --no-cache openssl libc6-compat
RUN npm i -g pnpm@${PNPM_VERSION}
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# 必须先 generate 再编译，否则 tsc 找不到 @prisma/client 的导出类型
RUN pnpm prisma generate \
 && pnpm build

# ── ③ 运行层 ────────────────────────────────────────────────
FROM node:${NODE_VERSION}-alpine AS runtime
WORKDIR /app
ARG PNPM_VERSION

RUN apk add --no-cache openssl libc6-compat tini \
 && npm i -g pnpm@${PNPM_VERSION}

ENV NODE_ENV=production \
    PORT=3000 \
    TZ=Asia/Shanghai

# 以 node 用户运行，不用 root
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/prisma ./prisma
COPY --from=build --chown=node:node /app/package.json ./package.json

COPY --chown=node:node docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

USER node
EXPOSE 3000

# tini 当 1 号进程负责回收僵尸进程并转发信号，
# 脚本里最后用 exec 把 node 顶上去，docker stop 才能干净退出
ENTRYPOINT ["/sbin/tini", "--", "/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "dist/index.js"]
