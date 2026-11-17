import { Router } from 'express'
import { z } from 'zod'
import { asyncHandler } from '../lib/asyncHandler'
import * as authService from '../services/auth.service'

export const authRouter = Router()

const registerSchema = z.object({
  email: z.string().email('邮箱格式不正确'),
  password: z.string().min(6, '密码至少 6 位').max(64, '密码太长'),
  name: z.string().min(1, '请填写昵称').max(20, '昵称最多 20 字'),
})

const loginSchema = z.object({
  email: z.string().email('邮箱格式不正确'),
  password: z.string().min(1, '请输入密码'),
})

authRouter.post(
  '/register',
  asyncHandler(async (req, res) => {
    const input = registerSchema.parse(req.body)
    res.status(201).json(await authService.register(input))
  }),
)

authRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    const input = loginSchema.parse(req.body)
    res.json(await authService.login(input))
  }),
)
