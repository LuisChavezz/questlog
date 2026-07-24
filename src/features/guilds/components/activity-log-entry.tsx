/**
 * ActivityLogEntry — renderizado compacto y estructurado de una entrada de la
 * bitácora de un guild (NO una frase narrativa): avatar + nombre del actor, el
 * título de la quest (enlaza al drawer) y el cambio como `Campo: viejo → nuevo`.
 * Fuente ÚNICA de este layout, compartida por la tarjeta del Overview y el modal
 * de historial, para que ambos formateen igual sin duplicar la lógica.
 */
import { ArrowRight, Plus } from 'lucide-react'

import type { GuildQuestActivityField } from '#/db/schema'
import { UserAvatar } from '#/components/user-avatar'
import { cn } from '#/lib/utils'
import {
  QUEST_OPEN_TRIGGER_ATTR,
  STATUS_OPTIONS,
} from '#/features/quests/components/quests-columns'
import type { MemberOption } from '#/features/quests/components/member-select'
import { formatQuestDueDate } from '#/features/quests/schemas/quest-schemas'
import type { GuildActivityLogEntry } from '../api/guild-activity-log-query'

// ─── Formateo de valores por campo ────────────────────────────────────────────

// Etiqueta legible de cada campo rastreado.
const FIELD_LABEL: Record<GuildQuestActivityField, string> = {
  status: 'Status',
  assigneeId: 'Assignee',
  supervisorId: 'Supervisor',
  dueDate: 'Due date',
}

// Etiqueta visible de cada status — MISMA fuente que la tabla/drawer
// (STATUS_OPTIONS), para no reintroducir un mapeo paralelo que pueda divergir.
const STATUS_LABEL_BY_VALUE = new Map(
  STATUS_OPTIONS.map((option) => [option.value, option.label]),
)

function formatStatusValue(value: string | null): string {
  if (value == null) return '—'
  return STATUS_LABEL_BY_VALUE.get(value) ?? value
}

// Nombre del miembro asignado/supervisor, o "Unassigned" cuando el valor es NULL
// (mismo texto que los selectores de asignación). Un id que ya no resuelve a un
// miembro (p. ej. alguien que dejó el guild) cae a "Unknown member", igual que
// MemberSelect/MemberDisplay.
function formatMemberValue(
  members: MemberOption[],
  userId: string | null,
): string {
  if (userId == null) return 'Unassigned'
  return members.find((m) => m.userId === userId)?.name ?? 'Unknown member'
}

// Fecha de vencimiento almacenada como ISO (o NULL = sin fecha). Se formatea con
// la MISMA utilidad que la tabla/drawer (`formatQuestDueDate`), parseando el ISO
// al Date que esa función espera.
function formatDueDateValue(iso: string | null): string {
  if (iso == null) return 'No due date'
  return formatQuestDueDate(new Date(iso))
}

function formatFieldValue(
  field: GuildQuestActivityField,
  value: string | null,
  members: MemberOption[],
): string {
  switch (field) {
    case 'status':
      return formatStatusValue(value)
    case 'assigneeId':
    case 'supervisorId':
      return formatMemberValue(members, value)
    case 'dueDate':
      return formatDueDateValue(value)
  }
}

export interface GuildActivityFieldChange {
  fieldLabel: string
  oldDisplay: string
  newDisplay: string
}

/**
 * Traduce una entrada `field_updated` a sus piezas de presentación (etiqueta del
 * campo + valores viejo/nuevo ya formateados). Devuelve `null` para eventos que
 * no son un cambio de campo (p. ej. `created`), que se renderizan aparte.
 */
export function formatGuildActivityFieldChange(
  entry: GuildActivityLogEntry,
  members: MemberOption[],
): GuildActivityFieldChange | null {
  if (entry.eventType !== 'field_updated' || entry.field == null) {
    return null
  }

  return {
    fieldLabel: FIELD_LABEL[entry.field],
    oldDisplay: formatFieldValue(entry.field, entry.oldValue, members),
    newDisplay: formatFieldValue(entry.field, entry.newValue, members),
  }
}

// Tiempo relativo legible sin librería externa.
function getRelativeTime(date: Date | string): string {
  const diff = Date.now() - new Date(date).getTime()
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 60) return minutes <= 1 ? 'just now' : `${minutes} minutes ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return hours === 1 ? '1 hour ago' : `${hours} hours ago`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days} days ago`
  const weeks = Math.floor(days / 7)
  return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`
}

// ─── Componente ───────────────────────────────────────────────────────────────

// Pastilla de un valor viejo/nuevo. `highlight` distingue el valor NUEVO.
function ValueChip({
  children,
  highlight,
}: {
  children: React.ReactNode
  highlight?: boolean
}) {
  return (
    <span
      className={cn(
        'inline-block max-w-[12rem] truncate rounded border px-1.5 py-0.5 align-middle tabular-nums',
        highlight
          ? 'border-primary/30 bg-primary/10 text-foreground'
          : 'border-border bg-muted/50 text-muted-foreground',
      )}
    >
      {children}
    </span>
  )
}

export function ActivityLogEntry({
  entry,
  members,
  onOpenQuest,
}: {
  entry: GuildActivityLogEntry
  members: MemberOption[]
  /**
   * Abre el drawer de detalle de la quest al hacer clic en su título. Omitido
   * (p. ej. dentro del modal de historial) el título se renderiza como texto
   * plano, sin ninguna afordancia de interactividad.
   */
  onOpenQuest?: (questId: string) => void
}) {
  const change = formatGuildActivityFieldChange(entry, members)

  return (
    <div className="flex items-start gap-3">
      <UserAvatar
        name={entry.actor?.name}
        image={entry.actor?.image}
        avatarId={entry.actor?.avatarId}
        initials={entry.actor?.initials}
        size="sm"
        className="mt-0.5 shrink-0"
      />

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        {/* Actor + tiempo relativo */}
        <p className="flex items-center gap-1.5 text-sm">
          <span className="truncate font-medium text-foreground">
            {entry.actor?.name ?? 'Unknown user'}
          </span>
          <span className="shrink-0 text-xs text-muted-foreground">
            · {getRelativeTime(entry.createdAt)}
          </span>
        </p>

        {/* Título de la quest — abre el drawer de detalle (mismo mecanismo que la
            tabla, de ahí el atributo de trigger para que el drawer no se cierre
            y reabra al cambiar de quest) SOLO cuando el caller provee
            `onOpenQuest` (la tarjeta). Sin él (el modal de historial) es texto
            plano: sin botón, sin afordancia de clic. */}
        {onOpenQuest ? (
          <button
            type="button"
            {...{ [QUEST_OPEN_TRIGGER_ATTR]: 'true' }}
            onClick={() => onOpenQuest(entry.questId)}
            className={cn(
              'w-full truncate rounded text-left text-sm font-medium text-foreground',
              'cursor-pointer transition-colors hover:text-primary hover:underline',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
            )}
          >
            {entry.questTitle}
          </button>
        ) : (
          <span className="truncate text-sm font-medium text-foreground">
            {entry.questTitle}
          </span>
        )}

        {/* Cambio: `created` con tratamiento distinto (pastilla + icono), o el
            cambio de campo como `Campo: viejo → nuevo`. */}
        {entry.eventType === 'created' ? (
          <span className="mt-0.5 inline-flex w-fit items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
            <Plus className="size-3 shrink-0" aria-hidden="true" />
            Created
          </span>
        ) : change ? (
          <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">
              {change.fieldLabel}
            </span>
            <ValueChip>{change.oldDisplay}</ValueChip>
            <ArrowRight className="size-3 shrink-0" aria-hidden="true" />
            <ValueChip highlight>{change.newDisplay}</ValueChip>
          </p>
        ) : null}
      </div>
    </div>
  )
}
