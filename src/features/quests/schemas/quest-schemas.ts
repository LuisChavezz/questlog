/**
 * Esquemas y utilidades de validación y formateo para los campos de fecha de una quest.
 * Centraliza la lógica para reutilizarla en el formulario de creación,
 * la edición inline de la tabla y cualquier vista futura.
 */
import { differenceInCalendarDays, format } from 'date-fns'
import { z } from 'zod'

// Patrón ISO 8601 restringido a fechas de calendario: YYYY-MM-DD
const DATE_INPUT_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

// Formatea un número a string de dos dígitos con cero a la izquierda (p.ej. 9 → "09")
function getDatePart(value: number) {
  return value.toString().padStart(2, '0')
}

/**
 * Extrae las partes numéricas (año, mes, día) de un string YYYY-MM-DD.
 * Retorna null si el string no coincide con el patrón esperado.
 */
function getDateInputParts(value: string) {
  const match = DATE_INPUT_PATTERN.exec(value)

  if (!match) {
    return null
  }

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])

  return { year, month, day }
}

/**
 * Verifica que un string YYYY-MM-DD represente una fecha de calendario válida.
 * Descarta fechas que pasan el patrón pero no existen (e.g., 2024-02-30).
 */
function isValidDateInput(value: string) {
  const parts = getDateInputParts(value)

  if (!parts) {
    return false
  }

  const { year, month, day } = parts
  const candidate = new Date(year, month - 1, day)

  return (
    candidate.getFullYear() === year &&
    candidate.getMonth() === month - 1 &&
    candidate.getDate() === day
  )
}

/**
 * Devuelve la fecha de hoy como string YYYY-MM-DD en hora local.
 * Acepta una fecha de referencia opcional para facilitar los tests.
 */
export function getTodayDateString(referenceDate = new Date()) {
  const year = referenceDate.getFullYear()
  const month = getDatePart(referenceDate.getMonth() + 1)
  const day = getDatePart(referenceDate.getDate())

  return `${year}-${month}-${day}`
}

/**
 * Convierte un Date a string YYYY-MM-DD usando sus partes UTC.
 * Se usa como valor de un <input type="date"> para evitar que el offset
 * de zona horaria desplace el día mostrado al usuario.
 */
export function getQuestDateInputValue(value: Date | null | undefined) {
  if (!value) {
    return ''
  }

  const date = new Date(value)

  return `${date.getUTCFullYear()}-${getDatePart(date.getUTCMonth() + 1)}-${getDatePart(date.getUTCDate())}`
}

/**
 * Convierte el string YYYY-MM-DD de un input de fecha en un Date UTC.
 * Almacena el valor como medianoche UTC para que la fecha nunca se desplace
 * por diferencias de zona horaria entre cliente y servidor.
 * Retorna null si el string está vacío (ausencia de fecha).
 */
export function parseQuestDueDateValue(value: string) {
  if (!value) {
    return null
  }

  const parts = getDateInputParts(value)

  if (!parts) {
    throw new Error('Invalid due date value')
  }

  const { year, month, day } = parts

  return new Date(Date.UTC(year, month - 1, day))
}

/**
 * Indica si una quest tiene su fecha de vencimiento en el pasado.
 * Compara los strings YYYY-MM-DD para evitar desfases por zona horaria.
 */
export function isQuestDueDateOverdue(
  value: Date | null | undefined,
  referenceDate = new Date(),
) {
  const dueDate = getQuestDateInputValue(value)

  return dueDate !== '' && dueDate < getTodayDateString(referenceDate)
}

/**
 * Formatea una fecha de vencimiento para mostrarla de forma legible en la UI.
 *
 * Rango relativo:
 *   -1 día  → "Yesterday"
 *    0 días → "Today"
 *   +1 día  → "Tomorrow"
 *   +2..+7  → "Next {weekday}" (e.g. "Next Monday")
 *
 * Fuera de ese rango usa la fecha formateada completa (e.g. "Jun 15, 2026").
 *
 * Internamente compara strings YYYY-MM-DD en lugar de Date objects para
 * no verse afectado por el offset de zona horaria local.
 */
export function formatQuestDueDate(value: Date | null | undefined): string {
  if (!value) return ''

  const dueDateStr = getQuestDateInputValue(value)
  const todayStr = getTodayDateString()

  // Crear fechas locales en medianoche para que differenceInCalendarDays
  // opere en la zona horaria local y devuelva el número de días correcto
  const dueDate = new Date(`${dueDateStr}T00:00:00`)
  const today = new Date(`${todayStr}T00:00:00`)

  const diff = differenceInCalendarDays(dueDate, today)

  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  if (diff === -1) return 'Yesterday'
  if (diff > 1 && diff <= 7) return `Next ${format(dueDate, 'EEEE')}`

  return format(dueDate, 'MMM d, yyyy')
}

// ─── Esquemas de campos reutilizables ─────────────────────────────────────────

/** Título de la quest: obligatorio, máximo 100 caracteres */
export const questTitleSchema = z
  .string()
  .min(1, 'Title is required')
  .max(100, 'Title must be 100 characters or fewer')

/** Descripción opcional: máximo 500 caracteres */
export const questDescriptionSchema = z
  .string()
  .max(500, 'Description must be 500 characters or fewer')
  .optional()

/** Estado posible de una quest */
export const questStatusSchema = z.enum([
  'backlog',
  'todo',
  'in_progress',
  'done',
  'cancelled',
])

/** Nivel de prioridad de una quest */
export const questPrioritySchema = z.enum(['low', 'medium', 'high', 'critical'])

/** Tags como string CSV opcional — se parsea a array en el servidor */
export const questTagsSchema = z.string().optional()

/**
 * Fecha de vencimiento como string YYYY-MM-DD.
 * Rechaza fechas pasadas y fechas con formato inválido (e.g. 2024-02-30).
 * El string vacío se trata como ausencia de fecha (campo opcional).
 */
export const questDueDateSchema = z
  .string()
  .refine((value) => {
    if (value === '') {
      return true
    }

    return isValidDateInput(value) && value >= getTodayDateString()
  }, 'Due date cannot be in the past')
  .optional()

// ─── Esquema de creación ───────────────────────────────────────────────────────

/**
 * Esquema para crear una quest.
 * El estado inicial siempre se resuelve en el servidor como `backlog`.
 */
export const createQuestSchema = z.object({
  title: questTitleSchema,
  description: questDescriptionSchema,
  priority: questPrioritySchema.default('medium'),
  tags: questTagsSchema,
  dueDate: questDueDateSchema,
})

export type CreateQuestValues = z.infer<typeof createQuestSchema>

// ─── Esquema de actualización ──────────────────────────────────────────────────

/**
 * Esquema para actualizar una quest desde la tabla (edición inline).
 * Todos los campos son opcionales excepto el id.
 * Pasar `undefined` omite el campo; pasar `''` en dueDate borra la fecha.
 */
export const updateQuestSchema = z.object({
  id: z.string().uuid(),
  title: questTitleSchema.optional(),
  status: questStatusSchema.optional(),
  priority: questPrioritySchema.optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  dueDate: questDueDateSchema,
})

export type UpdateQuestValues = z.infer<typeof updateQuestSchema>

// ─── Esquemas de eliminación ───────────────────────────────────────────────────

/** Esquema para eliminar una quest individual por id. */
export const deleteQuestSchema = z.object({
  id: z.string().uuid(),
})

export type DeleteQuestValues = z.infer<typeof deleteQuestSchema>

/** Esquema para eliminar múltiples quests por sus ids. */
export const deleteQuestsSchema = z.object({
  ids: z.array(z.string().uuid()).min(1),
})

export type DeleteQuestsValues = z.infer<typeof deleteQuestsSchema>
