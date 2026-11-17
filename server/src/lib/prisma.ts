import { PrismaClient } from '@prisma/client'

/**
 * 全局单例。
 * tsx watch 热重载时如果每次都 new 一个，连接池会被打满，所以挂到 globalThis 上复用。
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
