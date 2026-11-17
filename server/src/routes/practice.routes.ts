import { Router } from 'express'
import { z } from 'zod'
import { requireAuth } from '../middlewares/auth'
import { asyncHandler } from '../lib/asyncHandler'
import { parseScore, reviewEssay } from '../lib/llm'
import * as recordService from '../services/record.service'

export const practiceRouter = Router()

const streamSchema = z.object({
  essay: z.string().min(10, '至少写 10 个字符').max(5000, '一次最多 5000 字符'),
})

/**
 * SSE 流式批改。全过程：
 * 1. 先把响应头切到 text/event-stream，告诉浏览器“这是流”
 * 2. 模型每吐一小段，就写一条 `data: {...}\n\n`（两个换行是事件分隔符）
 * 3. 结束后补一条 `event: done`，带上记录 id 和分数
 * 4. 前端中途断开 → req 触发 close → abort 上游请求，不再烧 token
 */
practiceRouter.post(
  '/stream',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { essay } = streamSchema.parse(req.body)

    res.status(200).set({
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // 让 Nginx 不要缓冲
    })
    res.flushHeaders()

    const abort = new AbortController()

    // 注意：这里必须监听 res 而不是 req。
    // Node 16+ 里 req 的 'close' 在请求体读完时就会触发，
    // 监听它会导致流刚开始就被误判为“客户端断开”。
    // res 的 'close' 表示响应结束或连接被提前掐断，用 writableEnded 区分两种情况。
    res.on('close', () => {
      if (!res.writableEnded) abort.abort()
    })

    // 心跳：防止代理层把长时间没数据的连接掐掉
    const heartbeat = setInterval(() => res.write(': ping\n\n'), 15_000)

    let review = ''
    try {
      for await (const delta of reviewEssay(essay, abort.signal)) {
        review += delta
        res.write(`data: ${JSON.stringify({ delta })}\n\n`)
      }

      // 用户中途断开：不落库，避免留下半截记录
      if (abort.signal.aborted) return

      const score = parseScore(review)
      const record = await recordService.createRecord({
        userId: req.userId!,
        essay,
        review,
        score,
      })

      res.write(`event: done\ndata: ${JSON.stringify({ recordId: record.id, score })}\n\n`)
    } catch (err) {
      // 头已经发出去了，不能再改状态码，只能在流里发一条 error 事件
      if (!abort.signal.aborted) {
        console.error('[stream error]', err)
        res.write(`event: error\ndata: ${JSON.stringify({ message: '生成失败，请重试' })}\n\n`)
      }
    } finally {
      clearInterval(heartbeat)
      res.end()
    }
  }),
)
