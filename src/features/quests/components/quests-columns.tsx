/**
 * Definición de columnas para la tabla de quests.
 * Exporta createQuestsColumns — función factory que recibe el callback de
 * actualización y devuelve las columnas con soporte de edición inline.
 * También exporta questsColumns como instancia estática para el skeleton.
 */
import type { ColumnDef } from '@tanstack/react-table'
import type { LucideIcon } from 'lucide-react'
import {
  Activity,
  AlertCircle,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Calendar,
  CheckCircle2,
  Circle,
  Clock,
  Eye,
  Flag,
  MinusCircle,
  ScrollText,
  Tag,
  UserRound,
  XCircle,
} from 'lucide-react'

import { ColumnHeader } from '#/components/ui/data-table'
import { Checkbox } from '#/components/ui/checkbox'
import { dateFormatter } from '#/lib/format-date'

import type { Quest, QuestPriority, QuestStatus } from '#/db/schema'
import type { UpdateQuestValues } from '../schemas/quest-schemas'
import { InlineEditTitle } from './inline-edit-title'
import type { BadgeOption } from './inline-edit-badge'
import { InlineEditBadge } from './inline-edit-badge'
import { InlineEditDueDate } from './inline-edit-due-date'
import { InlineEditTags } from './inline-edit-tags'
import type { MemberOption } from './member-select'
import { MemberDisplay, MemberSelect } from './member-select'

// ─── Opciones de estado y prioridad ───────────────────────────────────────────

export const STATUS_OPTIONS: readonly BadgeOption[] = [
  { value: 'backlog', label: 'Backlog', icon: Circle, variant: 'backlog' },
  { value: 'todo', label: 'To Do', icon: Clock, variant: 'todo' },
  {
    value: 'in_progress',
    label: 'In Progress',
    icon: ArrowRight,
    variant: 'in_progress',
  },
  { value: 'done', label: 'Completed', icon: CheckCircle2, variant: 'done' },
  {
    value: 'cancelled',
    label: 'Cancelled',
    icon: XCircle,
    variant: 'cancelled',
  },
] as const

export const PRIORITY_OPTIONS: readonly BadgeOption[] = [
  { value: 'low', label: 'Low', icon: ArrowDown, variant: 'low' },
  { value: 'medium', label: 'Medium', icon: MinusCircle, variant: 'medium' },
  { value: 'high', label: 'High', icon: ArrowUp, variant: 'high' },
  {
    value: 'critical',
    label: 'Critical',
    icon: AlertCircle,
    variant: 'critical',
  },
] as const

// ─── Contexto de guild ────────────────────────────────────────────────────────

/**
 * Contexto que activa las columnas de asignado/supervisor. Solo se pasa cuando
 * la tabla se renderiza dentro de un guild; en la vista personal se omite y esas
 * columnas no aparecen.
 */
export interface QuestsColumnsGuildContext {
  // Miembros del guild para poblar los selectores (una sola lista, dos columnas)
  members: MemberOption[]
  onAssignmentChange: (input: {
    id: string
    field: 'assigneeId' | 'supervisorId'
    userId: string | null
  }) => void
  // Predicados de permiso por quest — fuente única en role-labels, mismos que
  // usa el servidor. `canManageQuest`: eje 1 (todos los campos + borrado +
  // reasignación). `canUpdateQuestStatus`: eje 2 (solo estado; incluye a
  // asignado/supervisor además de quienes pueden gestionar).
  canManageQuest: (quest: Quest) => boolean
  canUpdateQuestStatus: (quest: Quest) => boolean
}

// Nombre por el que se ordena un miembro asignado — el mismo que se ve en la
// celda (MemberDisplay/MemberSelect caen a 'Unknown member' si el id resuelve
// a un miembro sin nombre, o si no hay asignación). Recibe un índice
// userId→nombre ya construido para no re-escanear la lista de miembros en cada
// comparación del ordenamiento.
function getMemberSortName(
  nameByUserId: Map<string, string | null>,
  userId: string | undefined,
) {
  return (
    (userId !== undefined ? nameByUserId.get(userId) : undefined) ??
    'Unknown member'
  )
}

/**
 * Construye una columna de asignación (asignado o supervisor). La celda es
 * editable inline solo si el usuario actual es el dueño de la quest; de lo
 * contrario muestra el miembro asignado en modo lectura.
 */
function createAssignmentColumn(
  field: 'assigneeId' | 'supervisorId',
  header: string,
  icon: LucideIcon,
  guildContext: QuestsColumnsGuildContext,
): ColumnDef<Quest> {
  const { members, onAssignmentChange, canManageQuest } = guildContext

  // Índice userId→nombre construido UNA vez por columna. La tabla memoiza las
  // columnas sobre la lista de miembros (createQuestsColumns solo se reejecuta si
  // esa lista cambia), así que este Map se reconstruye justo cuando alguien entra
  // o sale del guild — nunca por comparación. El sort escanea el dataset completo
  // sin paginar, así que buscar el nombre linealmente por par era O(N·M).
  const memberNameByUserId = new Map(members.map((m) => [m.userId, m.name]))

  return {
    id: field,
    // `undefined` (no `null`) para que `sortUndefined: 'last'` reconozca las
    // filas sin asignar y las fije al final sin importar la dirección — la
    // celda sigue leyendo `row.original[field]` y no usa este accessor.
    accessorFn: (quest) => quest[field] ?? undefined,
    header: () => <ColumnHeader icon={icon}>{header}</ColumnHeader>,
    size: 180,
    minSize: 150,
    sortUndefined: 'last',
    sortingFn: (rowA, rowB, columnId) => {
      const a = rowA.getValue<string | undefined>(columnId)
      const b = rowB.getValue<string | undefined>(columnId)
      // Dos filas sin asignar empatan: se devuelve 0 (no un signo fijo) para que
      // el desempate estable por índice de fila decida su orden relativo. Así el
      // comparador es antisimétrico por sí mismo —compare(a,b) y compare(b,a)
      // dan ambos 0— en vez de delegar ese caso en la rama both-undefined de
      // `sortUndefined`, que devuelve un signo constante y viola la antisimetría.
      // El 0 es invariante ante la inversión por dirección, así que no reintroduce
      // el flip a "primero" en orden descendente. Agrupar las filas sin asignar al
      // final (en ambas direcciones) lo sigue garantizando `sortUndefined: 'last'`.
      if (a === undefined && b === undefined) return 0
      return getMemberSortName(memberNameByUserId, a).localeCompare(
        getMemberSortName(memberNameByUserId, b),
        undefined,
        { sensitivity: 'base' },
      )
    },
    cell: ({ row }) => {
      const quest = row.original
      const selectedId = quest[field]
      const selected = members.find((m) => m.userId === selectedId)
      // Reasignar es gestión (eje 1); quien no puede gestionar lo ve en lectura.
      const canEdit = canManageQuest(quest)

      if (!canEdit) {
        return <MemberDisplay member={selected} />
      }

      return (
        <MemberSelect
          value={selectedId}
          options={members}
          onChange={(userId) =>
            onAssignmentChange({ id: quest.id, field, userId })
          }
          aria-label={`Change ${header.toLowerCase()}`}
          variant="avatar"
        />
      )
    },
  }
}

// ─── Factory de columnas ──────────────────────────────────────────────────────

/**
 * Crea las definiciones de columnas para la tabla de quests.
 * @param onUpdate - Callback invocado cuando el usuario confirma una edición inline.
 * @param guildContext - Si se provee, añade las columnas de asignado/supervisor.
 */
export function createQuestsColumns(
  onUpdate: (data: UpdateQuestValues) => void,
  guildContext?: QuestsColumnsGuildContext,
): ColumnDef<Quest>[] {
  // Sin contexto de guild (vista personal) todo es editable: las quests
  // personales siempre pertenecen a quien las ve. Con contexto, mandan los
  // predicados de permiso.
  const canManage = (quest: Quest) =>
    guildContext ? guildContext.canManageQuest(quest) : true
  const canEditStatus = (quest: Quest) =>
    guildContext ? guildContext.canUpdateQuestStatus(quest) : true

  return [
    {
      id: 'select',
      size: 44,
      minSize: 44,
      maxSize: 44,
      enableSorting: false,
      enableHiding: false,
      enableResizing: false,
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected()
              ? true
              : table.getIsSomePageRowsSelected()
                ? 'indeterminate'
                : false
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all rows"
        />
      ),
      // Solo las filas gestionables son seleccionables — las acciones masivas
      // (borrar, cambio masivo de estado/prioridad) requieren gestión completa.
      // `getCanSelect()` deriva del predicado `enableRowSelection` de la tabla.
      cell: ({ row }) =>
        row.getCanSelect() ? (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label={`Select row ${row.index + 1}`}
            onClick={(e) => e.stopPropagation()}
          />
        ) : null,
    },

    // Title + description (título editable inline)
    {
      accessorKey: 'title',
      header: () => <ColumnHeader icon={ScrollText}>Quest</ColumnHeader>,
      size: 320,
      minSize: 220,
      cell: ({ row }) => {
        const { id, title, description } = row.original
        return (
          <div className="flex flex-col gap-0.5 min-w-0">
            <InlineEditTitle
              value={title}
              onSave={(newTitle) => onUpdate({ id, title: newTitle })}
              readOnly={!canManage(row.original)}
            />
            {description && (
              <span className="text-xs text-muted-foreground line-clamp-1 max-w-xs pl-1.5">
                {description}
              </span>
            )}
          </div>
        )
      },
    },

    // Status (badge editable inline)
    {
      accessorKey: 'status',
      header: () => <ColumnHeader icon={Activity}>Status</ColumnHeader>,
      size: 140,
      minSize: 132,
      cell: ({ row }) => {
        const { id, status } = row.original
        return (
          <InlineEditBadge
            value={status}
            options={STATUS_OPTIONS}
            onSave={(newStatus) =>
              onUpdate({ id, status: newStatus as QuestStatus })
            }
            label="status"
            readOnly={!canEditStatus(row.original)}
          />
        )
      },
      filterFn: (row, _columnId, filterValue: string[]) =>
        filterValue.length === 0 ||
        filterValue.includes(row.getValue('status')),
    },

    // Priority (badge editable inline)
    {
      accessorKey: 'priority',
      header: () => <ColumnHeader icon={Flag}>Priority</ColumnHeader>,
      size: 120,
      minSize: 112,
      cell: ({ row }) => {
        const { id, priority } = row.original
        return (
          <InlineEditBadge
            value={priority}
            options={PRIORITY_OPTIONS}
            onSave={(newPriority) =>
              onUpdate({ id, priority: newPriority as QuestPriority })
            }
            label="priority"
            readOnly={!canManage(row.original)}
          />
        )
      },
    },

    // Assignee y Supervisor — solo presentes cuando la tabla vive en un guild
    ...(guildContext
      ? [
          createAssignmentColumn(
            'assigneeId',
            'Assignee',
            UserRound,
            guildContext,
          ),
          createAssignmentColumn(
            'supervisorId',
            'Supervisor',
            Eye,
            guildContext,
          ),
        ]
      : []),

    // Tags (editable inline)
    {
      accessorKey: 'tags',
      header: () => <ColumnHeader icon={Tag}>Tags</ColumnHeader>,
      size: 200,
      minSize: 160,
      enableSorting: false,
      cell: ({ row }) => {
        const { id, tags } = row.original
        return (
          <InlineEditTags
            value={tags}
            onSave={(newTags) => onUpdate({ id, tags: newTags })}
            readOnly={!canManage(row.original)}
          />
        )
      },
    },

    // Due date (editable inline)
    {
      accessorKey: 'dueDate',
      header: () => <ColumnHeader icon={Calendar}>Due Date</ColumnHeader>,
      size: 130,
      minSize: 124,
      cell: ({ row }) => {
        const { id, dueDate } = row.original
        return (
          <InlineEditDueDate
            value={dueDate}
            onSave={(newDueDate) => onUpdate({ id, dueDate: newDueDate })}
            readOnly={!canManage(row.original)}
          />
        )
      },
    },

    // Created (solo lectura)
    {
      accessorKey: 'createdAt',
      header: () => <ColumnHeader icon={Clock}>Created</ColumnHeader>,
      size: 120,
      minSize: 112,
      cell: ({ getValue }) => {
        const date = getValue<Date>()
        return (
          <span className="text-sm text-muted-foreground tabular-nums">
            {dateFormatter.format(new Date(date))}
          </span>
        )
      },
    },
  ]
}

export const questsColumns = createQuestsColumns(() => {})

// Instancia estática con contexto de guild — para el skeleton de Suspense de la
// tabla de quests de un guild (incluye Assignee/Supervisor). Se construye con la
// MISMA factory que la tabla resuelta, así que su recuento de columnas nunca
// puede desincronizarse del real: si `createQuestsColumns` gana o pierde una
// columna de guild, este skeleton la refleja automáticamente.
export const guildQuestsColumns = createQuestsColumns(() => {}, {
  members: [],
  onAssignmentChange: () => {},
  canManageQuest: () => false,
  canUpdateQuestStatus: () => false,
})
