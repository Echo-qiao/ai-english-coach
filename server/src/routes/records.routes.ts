import { Router } from 'express'
import { z } from 'zod'
import { requireAuth } from '../middlewares/auth'
import { asyncHandler } from '../lib/asyncHandler'
import * as recordService from '../services/record.service'

export const recordsRouter = Router()

const listQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(30).default(10),
})

recordsRouter.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { cursor, limit } = listQuerySchema.parse(req.query)
    res.json(await recordService.listRecords(req.userId!, { cursor, limit }))
  }),
)

recordsRouter.get(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const record = await recordService.getRecord(req.userId!, req.params.id)
    res.json(record)
  }),
)
