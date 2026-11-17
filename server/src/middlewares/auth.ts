import type { RequestHandler } from 'express'
import { verifyToken } from '../lib/jwt'

/**
 * 鉴权中间件：校验 Authorization: Bearer <token>
 * 失败统一返回 401（未认证），不要返回 403（已认证但无权限），两者语义不同。
 */
export const requireAuth: RequestHandler = (req, res, next) => {
  const header = req.headers.authorization

  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ message: '请先登录' })
    return
  }

  try {
    const payload = verifyToken(header.slice(7))
    if (!payload.sub) {
      res.status(401).json({ message: '登录状态无效' })
      return
    }
    req.userId = payload.sub
    next()
  } catch {
    // token 过期、签名不对、格式错误都会走到这里
    res.status(401).json({ message: '登录已过期，请重新登录' })
  }
}
