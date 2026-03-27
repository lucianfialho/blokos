import { z } from 'zod'

export const lessonPathSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string().describe('Unique identifier for the item'),
        status: z
          .enum(['locked', 'current', 'completed'])
          .describe('Unlock state of the item'),
        groupLabel: z
          .string()
          .optional()
          .describe('Optional section label displayed above this item'),
      })
    )
    .describe('List of items to display in the zigzag path'),
  pathColor: z
    .string()
    .optional()
    .describe('Color of the connector between cards (CSS color, default #1CB0F6)'),
  className: z
    .string()
    .optional()
    .describe('CSS class applied to the outer wrapper'),
})
