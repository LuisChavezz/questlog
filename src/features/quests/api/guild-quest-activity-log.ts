// Diffing de campos para la bitácora de auditoría de quests de guild. Función
// pura, aislada del handler para poder testearse directa y para ser el único
// lugar que decide QUÉ campos se auditan y CÓMO se detecta un cambio real (los
// no-ops no deben generar fila). El handler solo la invoca dentro de su
// transacción y mapea el resultado a filas de `guild_quest_activity_log`.
import type { GuildQuestActivityField, QuestStatus } from '#/db/schema'
import { parseQuestDueDateValue } from '../schemas/quest-schemas'
import type { UpdateQuestValues } from '../schemas/quest-schemas'

// Valores PRE-update de la quest, tal como se leen de la fila bloqueada dentro
// de la transacción de update (fuente TOCTOU-segura de los `oldValue`).
export interface GuildQuestCurrentValues {
  status: QuestStatus
  assigneeId: string | null
  supervisorId: string | null
  dueDate: Date | null
}

// Un cambio de campo listo para persistirse. `oldValue`/`newValue` ya vienen
// serializados a texto (o null), la representación que guarda la bitácora.
export interface GuildQuestFieldChange {
  field: GuildQuestActivityField
  oldValue: string | null
  newValue: string | null
}

// Subconjunto del payload de update que contiene los campos rastreados. Cada uno
// es `undefined` cuando el update no lo toca.
//
// ALCANCE DELIBERADO: la bitácora audita SOLO status, assigneeId, supervisorId y
// dueDate. La exclusión de title, description, priority y tags es intencional
// (decisión de alcance), NO un olvido: editar esos campos no genera ninguna fila
// y por tanto no aparece en "Recent Activity" ni en el historial. Si en el futuro
// se decide auditarlos, hay que ampliar tanto este `Pick` como el enum de campos
// `GuildQuestActivityField` (en el esquema) — este es el único lugar que decide
// QUÉ se audita, así que empezar por aquí.
type TrackedUpdateFields = Pick<
  UpdateQuestValues,
  'status' | 'assigneeId' | 'supervisorId' | 'dueDate'
>

// Serializa una fecha a texto ISO (o null). Centralizado para que `oldValue` y
// `newValue` usen SIEMPRE la misma representación.
function serializeDueDate(value: Date | null): string | null {
  return value ? value.toISOString() : null
}

/**
 * Calcula, para una quest de guild, las filas de auditoría de los campos
 * rastreados (`status`, `assigneeId`, `supervisorId`, `dueDate`) que el update
 * (a) trae en el payload y (b) cambia de verdad respecto al valor actual.
 * Reenviar el mismo valor NO produce cambio.
 *
 * El orden de emisión es estable: status → assigneeId → supervisorId → dueDate.
 */
export function computeGuildQuestFieldChanges(
  current: GuildQuestCurrentValues,
  data: TrackedUpdateFields,
): GuildQuestFieldChange[] {
  const changes: GuildQuestFieldChange[] = []

  // status — string del enum. Presente solo si el payload lo trae.
  if (data.status !== undefined && data.status !== current.status) {
    changes.push({
      field: 'status',
      oldValue: current.status,
      newValue: data.status,
    })
  }

  // assigneeId / supervisorId — id de usuario o `null` (que limpia la
  // asignación). Comparar string|null directamente distingue "sin cambio" de
  // "cambió a/desde null"; `undefined` = campo no tocado, se omite.
  if (data.assigneeId !== undefined && data.assigneeId !== current.assigneeId) {
    changes.push({
      field: 'assigneeId',
      oldValue: current.assigneeId,
      newValue: data.assigneeId,
    })
  }
  if (
    data.supervisorId !== undefined &&
    data.supervisorId !== current.supervisorId
  ) {
    changes.push({
      field: 'supervisorId',
      oldValue: current.supervisorId,
      newValue: data.supervisorId,
    })
  }

  // dueDate — el payload trae el string YYYY-MM-DD (o '' para limpiar); se
  // parsea al MISMO Date UTC-medianoche que persiste el update y se compara por
  // VALOR temporal (getTime), nunca por referencia de objeto. `undefined` =
  // campo no tocado; `null` en ambos lados = sin cambio.
  if (data.dueDate !== undefined) {
    const nextDueDate = parseQuestDueDateValue(data.dueDate)
    const currentTime = current.dueDate ? current.dueDate.getTime() : null
    const nextTime = nextDueDate ? nextDueDate.getTime() : null
    if (currentTime !== nextTime) {
      changes.push({
        field: 'dueDate',
        oldValue: serializeDueDate(current.dueDate),
        newValue: serializeDueDate(nextDueDate),
      })
    }
  }

  return changes
}
