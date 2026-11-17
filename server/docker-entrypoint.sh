#!/bin/sh
# 容器启动入口：
# 1) 等数据库可用（compose 的 healthcheck 已经保证了，这里再加一道网络兜底）
# 2) 把 Prisma schema 同步到库（幂等：表已存在就什么也不做）
# 3) exec 交给 node，让 node 成为 1 号进程的直系子进程，能正常收到 SIGTERM

set -e

echo "[entrypoint] 同步数据库表结构 ..."
# --skip-generate：客户端在镜像构建阶段已经生成好了，运行时不重复下载
./node_modules/.bin/prisma db push --skip-generate

echo "[entrypoint] 启动 API ..."
exec "$@"
