import { request } from './http'

export type UserInfo = { id: string; email: string; name: string }
export type AuthResponse = { token: string; user: UserInfo }

export type RecordSummary = {
  id: string
  title: string
  score: number | null
  createdAt: string
}

export type RecordDetail = RecordSummary & { essay: string; review: string }

export type ListResponse = {
  list: RecordSummary[]
  hasMore: boolean
  nextCursor: string | null
}

export function register(email: string, password: string, name: string) {
  return request.post<AuthResponse>('/auth/register', { email, password, name })
}

export function login(email: string, password: string) {
  return request.post<AuthResponse>('/auth/login', { email, password })
}

export function listRecords(cursor?: string, limit = 10) {
  return request.get<ListResponse>('/records', { cursor, limit })
}

export function getRecord(id: string) {
  return request.get<RecordDetail>(`/records/${id}`)
}

export type StreamHandlers = {
  onDelta: (text: string) => void
  onDone: (payload: { recordId: string; score: number | null }) => void
  onError: (message: string) => void
}

/**
 * SSE 客户端。
 * 为什么不用 EventSource：它只能发 GET、不能带 Authorization 头，
 * 所以这里用 fetch + ReadableStream 手动读流、手动解析事件。
 */
export async function streamReview(essay: string, handlers: StreamHandlers, signal: AbortSignal) {
  const response = await fetch('/api/practice/stream', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${localStorage.getItem('token') ?? ''}`,
    },
    body: JSON.stringify({ essay }),
    signal,
  })

  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.message ?? `请求失败（${response.status}）`)
  }
  if (!response.body) throw new Error('当前浏览器不支持流式响应')

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    // stream: true 保证多字节的中文字符不会被截断成乱码
    buffer += decoder.decode(value, { stream: true })

    // 事件以空行分隔；一次可能只读到半个事件，剩下的留在 buffer 等下一轮
    let index = buffer.indexOf('\n\n')
    while (index !== -1) {
      const frame = buffer.slice(0, index)
      buffer = buffer.slice(index + 2)
      dispatchFrame(frame, handlers)
      index = buffer.indexOf('\n\n')
    }
  }
}

function dispatchFrame(frame: string, handlers: StreamHandlers) {
  let event = 'message'
  const dataLines: string[] = []

  for (const line of frame.split('\n')) {
    if (line.startsWith(':')) continue // 注释/心跳，忽略
    if (line.startsWith('event:')) event = line.slice(6).trim()
    else if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart())
  }

  if (dataLines.length === 0) return

  try {
    const payload = JSON.parse(dataLines.join('\n'))
    if (event === 'done') handlers.onDone(payload)
    else if (event === 'error') handlers.onError(payload.message ?? '生成失败')
    else handlers.onDelta(payload.delta ?? '')
  } catch {
    console.warn('无法解析的 SSE 数据：', frame)
  }
}
