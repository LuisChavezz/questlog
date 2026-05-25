import { z } from 'zod'

function getDatePart(value: number) {
  return value.toString().padStart(2, '0')
}

function isValidDateInput(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)

  if (!match) {
    return false
  }

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const candidate = new Date(year, month - 1, day)

  return (
    candidate.getFullYear() === year &&
    candidate.getMonth() === month - 1 &&
    candidate.getDate() === day
  )
}

export function getTodayDateString(referenceDate = new Date()) {
  const year = referenceDate.getFullYear()
  const month = getDatePart(referenceDate.getMonth() + 1)
  const day = getDatePart(referenceDate.getDate())

  return `${year}-${month}-${day}`
}

// Esquemas de campos reutilizables
export const questTitleSchema = z
  .string()
  .min(1, 'Title is required')
  .max(100, 'Title must be 100 characters or fewer')

export const questDescriptionSchema = z
  .string()
  .max(500, 'Description must be 500 characters or fewer')
  .optional()

export const questStatusSchema = z.enum([
  'backlog',
  'todo',
  'in_progress',
  'done',
  'cancelled',
])

export const questPrioritySchema = z.enum(['low', 'medium', 'high', 'critical'])

export const questTagsSchema = z.string().optional()

export const questDueDateSchema = z
  .string()
  .refine((value) => {
    if (value === '') {
      return true
    }

    return isValidDateInput(value) && value >= getTodayDateString()
  }, 'Due date cannot be in the past')
  .optional()

// Esquema principal para crear una quest.
// El estado inicial siempre se resuelve en el servidor como `backlog`.
export const createQuestSchema = z.object({
  title: questTitleSchema,
  description: questDescriptionSchema,
  priority: questPrioritySchema.default('medium'),
  tags: questTagsSchema,
  dueDate: questDueDateSchema,
})

export type CreateQuestValues = z.infer<typeof createQuestSchema>

// Esquema para actualizar una quest desde la tabla (edición inline).
// Todos los campos son opcionales excepto el id.
export const updateQuestSchema = z.object({
  id: z.string().uuid(),
  title: questTitleSchema.optional(),
  status: questStatusSchema.optional(),
  priority: questPrioritySchema.optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
})

export type UpdateQuestValues = z.infer<typeof updateQuestSchema>
