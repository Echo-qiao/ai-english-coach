import bcrypt from 'bcryptjs'
import { prisma } from '../lib/prisma'
import { signToken } from '../lib/jwt'
import { AppError } from '../middlewares/error'

type RegisterInput = { email: string; password: string; name: string }

function toPublicUser(user: { id: string; email: string; name: string }) {
  return { id: user.id, email: user.email, name: user.name }
}

export async function register(input: RegisterInput) {
  const exists = await prisma.user.findUnique({ where: { email: input.email } })
  if (exists) throw new AppError(409, '该邮箱已注册')

  // 存哈希不存明文；cost=10 是速度和安全性的折中
  const password = await bcrypt.hash(input.password, 10)

  const user = await prisma.user.create({
    data: { email: input.email, password, name: input.name },
  })

  return { token: signToken(user.id), user: toPublicUser(user) }
}

export async function login(input: { email: string; password: string }) {
  const user = await prisma.user.findUnique({ where: { email: input.email } })

  // 用户不存在和密码错误返回同一句，避免暴露邮箱是否注册过
  if (!user) throw new AppError(401, '邮箱或密码错误')

  const matched = await bcrypt.compare(input.password, user.password)
  if (!matched) throw new AppError(401, '邮箱或密码错误')

  return { token: signToken(user.id), user: toPublicUser(user) }
}
