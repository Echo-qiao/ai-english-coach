import jwt from 'jsonwebtoken'
import { env } from '../config'

export type TokenPayload = {
  sub: string // 用户 id
  iat: number
  exp: number
}

export function signToken(userId: string): string {
  return jwt.sign({ sub: userId }, env.JWT_SECRET, { expiresIn: '7d' })
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, env.JWT_SECRET) as TokenPayload
}
