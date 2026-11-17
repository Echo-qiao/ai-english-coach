import OpenAI from 'openai'
import { env, isMockMode } from '../config'

const SYSTEM_PROMPT = `你是一位严谨的英语写作老师，负责批改中国学生的英语作文。
请严格按下面的 Markdown 格式输出，不要输出任何多余内容：

## 总评
（2-3 句话，指出文章整体水平和最主要的问题）

## 问题清单
1. 原句 → 修改建议（说明原因，中文）
2. …（最多 5 条）

## 评分
（只写一个 0-100 的整数）`

/** 把模型输出里的分数抠出来。抽不到就返回 null，不要瞎猜。 */
export function parseScore(review: string): number | null {
  const match = review.match(/##\s*评分\s*\n+\s*(\d{1,3})/)
  if (!match) return null
  const score = Number(match[1])
  return score >= 0 && score <= 100 ? score : null
}

/**
 * 流式批改。这是整个项目的技术核心：
 * 调用方拿到的是 AsyncGenerator，每 yield 一小段文本，
 * 路由层立刻写成一条 SSE 事件推给前端。
 */
export async function* reviewEssay(
  essay: string,
  signal: AbortSignal,
): AsyncGenerator<string, void, unknown> {
  if (isMockMode) {
    yield* mockReview(essay, signal)
    return
  }

  const client = new OpenAI({ apiKey: env.OPENAI_API_KEY, baseURL: env.OPENAI_BASE_URL })

  const stream = await client.chat.completions.create(
    {
      model: env.OPENAI_MODEL,
      stream: true,
      temperature: 0.3,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: essay },
      ],
    },
    { signal },
  )

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content
    if (delta) yield delta
  }
}

/** 没有 API Key 时的模拟输出：行为和真模型一致，只是内容是写死的 */
async function* mockReview(essay: string, signal: AbortSignal): AsyncGenerator<string, void, unknown> {
  const words = essay.trim().split(/\s+/).filter(Boolean).length
  const text = `## 总评
这是一篇结构完整、表达清楚的作文，共 ${words} 个单词。整体逻辑连贯，但存在少量时态与介词搭配问题，句式也偏简单，建议适当使用从句和连接词提升层次。

## 问题清单
1. I go to school yesterday. → I went to school yesterday.（过去时间状语要用一般过去时）
2. I am interesting in music. → I am interested in music.（-ing 形容词修饰物，-ed 修饰人）
3. In my opinion, I think it is good. → In my opinion, it is good.（语义重复）

## 评分
78
`
  for (const char of text) {
    if (signal.aborted) return
    await new Promise((r) => setTimeout(r, 12))
    yield char
  }
}
