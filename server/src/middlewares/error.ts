import type { ErrorRequestHandler, RequestHandler } from 'express'
import { ZodError } from 'zod'

/** 业务异常：带状态码，方便统一抛出 */
export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
    this.name = 'AppError'
  }
}

/**
 * body-parser（底层是 raw-body）抛的错长这样：
 *   { type: 'entity.parse.failed', statusCode: 400, expose: true, body: '...' }
 * 它自带了 statusCode，但如果不特判，就会被当成未知错误 → 500。
 * 客户端于是以为「服务器坏了」，实际只是它发的 JSON 不合法。
 */
type BodyParserError = Error & {
  type?: string
  status?: number
  statusCode?: number
}

const BODY_ERROR_MESSAGES: Record<string, string> = {
  'entity.parse.failed': '请求体不是合法的 JSON',
  'entity.too.large': '请求体过大',
  'entity.verify.failed': '请求体校验失败',
  'encoding.unsupported': '不支持的 Content-Encoding',
  'charset.unsupported': '不支持的字符集',
  'request.aborted': '请求已中断',
}

function isBodyParserError(err: unknown): err is BodyParserError {
  const e = err as BodyParserError | null
  return (
    typeof e === 'object' &&
    e !== null &&
    typeof e.type === 'string' &&
    e.type in BODY_ERROR_MESSAGES
  )
}

/** 从任意错误上取一个「本来就是 4xx」的状态码，取不到返回 null */
function clientStatusOf(err: unknown): number | null {
  const e = err as BodyParserError | null
  if (typeof e !== 'object' || e === null) return null
  const status = e.status ?? e.statusCode
  if (typeof status !== 'number') return null
  return status >= 400 && status < 500 ? status : null
}

export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({ message: '接口不存在' })
}

/**
 * 全局错误中间件。
 * 注意两点：
 * 1. 必须 4 个参数，Express 才认它是错误中间件
 * 2. 必须注册在所有路由之后（index.ts 里），否则捕获不到路由里的异常
 */
export const errorHandler: ErrorRequestHandler = (err, _req, res, next) => {
  // 响应头已经发出去了就改不了状态码了。
  // SSE 接口尤其容易踩：流已经开始推数据，中途抛错再 res.status() 会报
  // "Cannot set headers after they are sent"。交给 Express 默认处理（直接断开连接）。
  if (res.headersSent) {
    next(err)
    return
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      message: '参数校验失败',
      issues: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    })
    return
  }

  if (err instanceof AppError) {
    res.status(err.status).json({ message: err.message })
    return
  }

  // Prisma 唯一约束冲突
  if (err?.code === 'P2002') {
    res.status(409).json({ message: '该邮箱已被注册' })
    return
  }

  // 请求体解析失败：按类型给出对应状态码，别报成 500
  if (isBodyParserError(err)) {
    const status =
      err.type === 'entity.too.large'
        ? 413
        : err.type === 'encoding.unsupported' || err.type === 'charset.unsupported'
          ? 415
          : 400
    res.status(status).json({ message: BODY_ERROR_MESSAGES[err.type!] })
    return
  }

  // 兜底：任何自带 4xx 状态的错误（http-errors 之类）都尊重它
  const clientStatus = clientStatusOf(err)
  if (clientStatus) {
    res.status(clientStatus).json({ message: err.message || '请求参数有误' })
    return
  }

  // 到这里才是真正的服务端故障，日志留全量，响应只给一句话，不泄露内部细节
  console.error('[unhandled error]', err)
  res.status(500).json({ message: '服务器内部错误' })
}
