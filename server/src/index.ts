import express from 'express'
import cors from 'cors'
import { env, isMockMode } from './config'
import './types'
import { authRouter } from './routes/auth.routes'
import { practiceRouter } from './routes/practice.routes'
import { recordsRouter } from './routes/records.routes'
import { errorHandler, notFoundHandler } from './middlewares/error'

const app = express()

app.use(cors()) // 开发期全放开；上线时换成白名单：cors({ origin: 'https://你的域名' })
app.use(express.json({ limit: '1mb' }))

app.get('/health', (_req, res) => {
  res.json({ ok: true, mock: isMockMode })
})

app.use('/api/auth', authRouter)
app.use('/api/practice', practiceRouter)
app.use('/api/records', recordsRouter)

// 顺序很重要：先 404，再错误中间件，且必须在所有路由之后
app.use(notFoundHandler)
app.use(errorHandler)

app.listen(env.PORT, () => {
  console.log(`[server] http://127.0.0.1:${env.PORT}`)
  console.log(`[server] LLM 模式：${isMockMode ? '模拟流式（未配置 API Key）' : '真实模型'}`)
})
