# syntax=docker/dockerfile:1
#
# 前端镜像：Vite 构建出静态文件，交给 Nginx 托管并对 /api 做反向代理
# 构建：docker build -t coach-web ./client
#
# 之所以不用 node 跑 vite preview：生产环境要的是静态托管 + 反代 + 压测得住，
# Nginx 两件事都做得更好，镜像也只有几十 MB。

ARG NODE_VERSION=22
ARG PNPM_VERSION=10
ARG NGINX_VERSION=1.27-alpine

# ── ① 构建层 ────────────────────────────────────────────────
FROM node:${NODE_VERSION}-alpine AS build
WORKDIR /app
ARG PNPM_VERSION
RUN npm i -g pnpm@${PNPM_VERSION}

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
# build 脚本里含 vue-tsc --noEmit，类型错了构建会直接失败，等于顺手做了一次类型门禁
RUN pnpm build

# ── ② 运行层 ────────────────────────────────────────────────
FROM nginx:${NGINX_VERSION} AS runtime
ENV TZ=Asia/Shanghai

# 默认配置文件会抢 80 端口的默认站点，直接换成我们自己的
RUN rm -f /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
