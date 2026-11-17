import 'dotenv/config'
import { z } from 'zod'

/**
 * 环境变量统一在这里校验。
 * 好处：配置写错了启动就报错，而不是等到某个接口 500 才发现。
 */
const schema = z.object({
  DATABASE_URL: z.string().min(1),
  PORT: z.coerce.number().default(3000),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET 至少 16 位'),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_BASE_URL: z.string().optional(),
  OPENAI_MODEL: z.string().default('deepseek-chat'),
})

const parsed = schema.safeParse(process.env)

if (!parsed.success) {
  console.error('环境变量配置有误：', parsed.error.flatten().fieldErrors)
  process.exit(1)
}

export const env = parsed.data

/** 没配 API Key 时走模拟流式输出，保证项目在任何机器上都能跑通 */
export const isMockMode = !env.OPENAI_API_KEY
