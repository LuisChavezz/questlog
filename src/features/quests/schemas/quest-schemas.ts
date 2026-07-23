/**
 * Esquemas y utilidades de validación y formateo para los campos de fecha de una quest.
 * Centraliza la lógica para reutilizarla en el formulario de creación,
 * la edición inline de la tabla y cualquier vista futura.
 */
import { differenceInCalendarDays, format } from 'date-fns'
import { z } from 'zod'

import type { QuestStatus } from '#/db/schema'

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
 * Estados "cerrados": una quest completada o cancelada ya no tiene dimensión
 * de urgencia — ni "overdue" ni "due soon" aplican, sin importar su fecha.
 * Compartido por `isQuestOverdue` e `isQuestDueSoon`.
 */
const CLOSED_QUEST_STATUSES: readonly QuestStatus[] = ['done', 'cancelled']

/**
 * Definición única de quest "vencida" (overdue): tiene fecha de vencimiento en
 * el pasado Y su estado no es done/cancelled. Una quest sin fecha nunca está
 * vencida (lo garantiza `isQuestDueDateOverdue`).
 *
 * Fuente compartida por el filtro "Overdue" de la tabla y el badge de Guild
 * Overview; el conteo del servidor (`get-guild`) replica esta misma regla en
 * SQL (`lt(dueDate, hoy)` + `notInArray(status, [...])`).
 */
export function isQuestOverdue(
  quest: { dueDate: Date | null; status: QuestStatus },
  referenceDate = new Date(),
) {
  return (
    !CLOSED_QUEST_STATUSES.includes(quest.status) &&
    isQuestDueDateOverdue(quest.dueDate, referenceDate)
  )
}

// Ventana (en días de calendario, ambos extremos inclusive) que cuenta como
// "próxima a vencer": hoy mismo hasta 3 días en el futuro.
const DUE_SOON_WINDOW_DAYS = 3

/**
 * Indica si una fecha de vencimiento cae dentro de la ventana "due soon"
 * (hoy..+3 días, inclusive). Compara días de calendario completos —vía
 * `differenceInCalendarDays` sobre medianoches LOCALES derivadas del string
 * YYYY-MM-DD, mismo patrón que `formatQuestDueDate`— para no verse afectada
 * por horas ni por el offset de zona horaria del `Date` original.
 */
export function isQuestDueDateSoon(
  value: Date | null | undefined,
  referenceDate = new Date(),
) {
  const dueDateStr = getQuestDateInputValue(value)

  if (dueDateStr === '') {
    return false
  }

  const dueDate = new Date(`${dueDateStr}T00:00:00`)
  const today = new Date(`${getTodayDateString(referenceDate)}T00:00:00`)
  const diff = differenceInCalendarDays(dueDate, today)

  return diff >= 0 && diff <= DUE_SOON_WINDOW_DAYS
}

/**
 * Definición única de quest "próxima a vencer" (due soon): su fecha cae en la
 * ventana hoy..+3 días Y su estado no es done/cancelled — misma exclusión y
 * mismo motivo que `isQuestOverdue` (ver `CLOSED_QUEST_STATUSES`).
 */
export function isQuestDueSoon(
  quest: { dueDate: Date | null; status: QuestStatus },
  referenceDate = new Date(),
) {
  return (
    !CLOSED_QUEST_STATUSES.includes(quest.status) &&
    isQuestDueDateSoon(quest.dueDate, referenceDate)
  )
}

/**
 * Indica si una quest no tiene fecha de vencimiento asignada. Sin exclusión de
 * estado: sin fecha, no hay dimensión de urgencia que evaluar en absoluto —a
 * diferencia de overdue/due soon, done/cancelled no cambian este resultado.
 */
export function isQuestWithoutDueDate(quest: { dueDate: Date | null }) {
  return quest.dueDate === null
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

/**
 * Parsea un search param `status` (lista de estados separada por comas, p. ej.
 * `"backlog,todo,in_progress"` desde los stat cards de Guild Overview) a un
 * array de `QuestStatus` válidos. Valores desconocidos o vacíos se descartan
 * en silencio en vez de reventar la navegación — mismo criterio que
 * `.catch(undefined)` en `authSearchSchema`.
 */
export function parseQuestStatusListParam(
  value: string | undefined,
): QuestStatus[] {
  if (!value) return []

  return value
    .split(',')
    .filter(
      (status): status is QuestStatus =>
        questStatusSchema.safeParse(status).success,
    )
}

/** Nivel de prioridad de una quest */
export const questPrioritySchema = z.enum(['low', 'medium', 'high', 'critical'])

/** Tags como string CSV opcional — se parsea a array en el servidor */
export const questTagsSchema = z.string().optional()

/**
 * Id del guild al que pertenece la quest. NULL/ausente = quest personal.
 * Se valida como cadena no vacía; la existencia real y la membresía se verifican
 * en el servidor contra guild_members.
 *
 * Hoy coincide con `questUserRefSchema` en su regla de validación, pero son
 * conceptos distintos (id de guild vs. id de usuario) que solo comparten esa
 * regla por casualidad — no se consolidan a propósito, para que un cambio futuro
 * en uno (p. ej. un prefijo o formato propio de los ids de guild) no se aplique
 * sin querer al otro por asumir que son lo mismo.
 */
export const questGuildIdSchema = z.string().min(1)

/**
 * Referencia a un usuario (asignado o supervisor). Cadena no vacía; que el
 * usuario pertenezca al mismo guild de la quest se valida en el servidor.
 *
 * Ver la nota en `questGuildIdSchema`: mismo caso, distinto concepto.
 */
export const questUserRefSchema = z.string().min(1)

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
 *
 * Campos de guild (`guildId`, `assigneeId`, `supervisorId`) son opcionales:
 * ausentes en una quest personal. La regla `assignee/supervisor exigen guildId`
 * se refuerza aquí (cross-field) y la pertenencia real al guild se valida en el
 * servidor — el cliente nunca es la autoridad final.
 */
export const createQuestSchema = z
  .object({
    title: questTitleSchema,
    description: questDescriptionSchema,
    priority: questPrioritySchema.default('medium'),
    tags: questTagsSchema,
    dueDate: questDueDateSchema,
    guildId: questGuildIdSchema.optional(),
    assigneeId: questUserRefSchema.optional(),
    supervisorId: questUserRefSchema.optional(),
  })
  .refine(
    // Una quest personal (sin guildId) no tiene concepto de asignado/supervisor
    (data) =>
      data.guildId != null ||
      (data.assigneeId == null && data.supervisorId == null),
    {
      message: 'Assignee and supervisor require a guild',
      path: ['assigneeId'],
    },
  )

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
  description: questDescriptionSchema,
  status: questStatusSchema.optional(),
  priority: questPrioritySchema.optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  dueDate: questDueDateSchema,
  // Asignado/supervisor: `undefined` omite el campo; `null` lo limpia; una
  // cadena lo fija. La pertenencia al guild de la quest se valida en el servidor.
  assigneeId: questUserRefSchema.nullable().optional(),
  supervisorId: questUserRefSchema.nullable().optional(),
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
