/**
 * 给 Express 的 Request 补一个 userId 字段。
 * 声明了这里，res.locals 之外也能直接 req.userId 拿到登录用户。
 */
declare global {
  namespace Express {
    interface Request {
      userId?: string
    }
  }
}

export {}
