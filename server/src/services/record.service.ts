import { prisma } from '../lib/prisma'
import { AppError } from '../middlewares/error'

/** 列表只需要这几个字段，不要 select * */
const LIST_SELECT = { id: true, title: true, score: true, createdAt: true } as const

export function makeTitle(essay: string): string {
  const text = essay.replace(/\s+/g, ' ').trim()
  return text ? text.slice(0, 40) : '未命名练习'
}

export async function createRecord(input: {
  userId: string
  essay: string
  review: string
  score: number | null
}) {
  return prisma.record.create({
    data: {
      userId: input.userId,
      title: makeTitle(input.essay),
      essay: input.essay,
      review: input.review,
      score: input.score,
    },
  })
}

/**
 * 游标分页：按 (createdAt, id) 倒序，用上一页最后一条的 id 作为下一页起点。
 * 不用 offset 的原因：深分页时数据库要跳过前 N 行，越翻越慢。
 */
export async function listRecords(userId: string, options: { cursor?: string; limit: number }) {
  const rows = await prisma.record.findMany({
    where: { userId },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: options.limit + 1, // 多取一条，用来判断有没有下一页
    ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
    select: LIST_SELECT,
  })

  const hasMore = rows.length > options.limit
  const list = hasMore ? rows.slice(0, options.limit) : rows

  return {
    list,
    hasMore,
    nextCursor: hasMore ? list[list.length - 1].id : null,
  }
}

/**
 * 详情查询带上 userId 作为条件，这就是防越权的关键。
 * 查不到统一 404（而不是 403），避免泄露“这条记录存在但不属于你”。
 */
export async function getRecord(userId: string, id: string) {
  const record = await prisma.record.findFirst({ where: { id, userId } })
  if (!record) throw new AppError(404, '记录不存在')
  return record
}
