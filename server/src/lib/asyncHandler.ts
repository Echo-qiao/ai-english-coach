import type { NextFunction, Request, RequestHandler, Response } from 'express'

/**
 * Express 4 不会自动捕获 async 函数里抛出的异常。
 * 用这个包一层，把 reject 转交给 next(err)，交给全局错误中间件处理。
 * （Express 5 已内置等价能力，这里是 4.x 的通用写法）
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next)
  }
}
