/**
 * Definición de columnas para la tabla de quests.
 * Exporta createQuestsColumns — función factory que recibe el callback de
 * actualización y devuelve las columnas con soporte de edición inline.
 * También exporta questsColumns como instancia estática para el skeleton.
 */
import type { ColumnDef, Row } from '@tanstack/react-table'
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
  PanelRightOpen,
  ScrollText,
  Tag,
  UserRound,
  XCircle,
} from 'lucide-react'

import { ColumnHeader } from '#/components/ui/data-table'
import type {
  DataTableFilterDef,
  DataTableFilterOptionIconProps,
} from '#/components/ui/data-table-filter'
import { Button } from '#/components/ui/button'
import { Checkbox } from '#/components/ui/checkbox'
import { Tooltip } from '#/components/ui/tooltip'
import { dateFormatter } from '#/lib/format-date'

import type { Quest, QuestPriority, QuestStatus } from '#/db/schema'
import type { UpdateQuestValues } from '../schemas/quest-schemas'
import { InlineEditTitle } from './inline-edit-title'
import type { BadgeOption } from './inline-edit-badge'
import { InlineEditBadge } from './inline-edit-badge'
import { InlineEditDueDate } from './inline-edit-due-date'
import { InlineEditTags } from './inline-edit-tags'
import type { MemberOption } from './member-select'
import {
  MemberAvatarOrPlaceholder,
  MemberDisplay,
  MemberSelect,
  UNASSIGNED_VALUE,
} from './member-select'

// Marca cada trigger "Open" de fila para que el drawer de detalle (no modal)
// pueda distinguir "clic en OTRO trigger de fila" de un clic realmente externo
// en su propio `onPointerDownOutside` — así evita cerrarse y reabrirse al
// cambiar de quest en vez de intercambiar el contenido en el sitio.
export const QUEST_OPEN_TRIGGER_ATTR = 'data-quest-open-trigger'

// IDs de columna que se fijan al borde izquierdo (checkbox + título) para que
// la identidad de la fila siga visible durante el scroll horizontal —
// `DataTable` es genérico y no asume esto por sí solo, así que cada tabla de
// quests (personal y de guild) pasa este mismo valor a su prop
// `stickyLeadingColumnIds`. Una sola constante para las tres pantallas que
// renderizan la tabla (cargada o su skeleton de Suspense) evita que diverjan.
export const QUEST_TABLE_STICKY_LEADING_COLUMN_IDS = [
  'select',
  'title',
] as const

// ─── Filtrado multi-select ─────────────────────────────────────────────────────

// Predicado compartido por todas las columnas con filtro multi-select: sin
// selección (`[]`, chip recién creado o vaciado) no filtra nada; con
// selección, solo pasan las filas cuyo valor esté incluido.
function matchesMultiSelectFilter(filterValue: string[], value: string) {
  return filterValue.length === 0 || filterValue.includes(value)
}

// `filterFn` reutilizable para columnas cuyo valor filtrable ES el que ya
// expone `row.getValue(columnId)` (Status, Priority) — no sirve para
// Assignee/Supervisor, que comparan contra `row.original[field] ??
// UNASSIGNED_VALUE` en vez del valor que ya normalizó el accessor (ver
// `createAssignmentColumn`, que arma su propio `filterFn` con ese matiz).
function multiSelectFilterFn(
  row: Row<Quest>,
  columnId: string,
  filterValue: string[],
) {
  return matchesMultiSelectFilter(filterValue, row.getValue(columnId))
}

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

// Filtros de columnas con opciones fijas (enum), disponibles siempre. Mismo
// orden que las columnas de la tabla. Assignee/Supervisor (opciones dinámicas:
// miembros del guild) NO viven aquí — ver `createAssigneeFilterDef` y
// `createSupervisorFilterDef` — así que el caller que sí tenga contexto de
// guild los agrega aparte, después de estos dos.
export const QUEST_FILTERS: readonly DataTableFilterDef[] = [
  {
    id: 'status',
    columnId: 'status',
    label: 'Status',
    options: STATUS_OPTIONS,
  },
  {
    id: 'priority',
    columnId: 'priority',
    label: 'Priority',
    options: PRIORITY_OPTIONS,
  },
]

// Filtro de asignación (Assignee o Supervisor): sus opciones son los miembros
// reales del guild (más "Unassigned" para quests sin asignar), no un enum
// fijo — por eso se arma en runtime a partir de la lista de miembros ya
// disponible (la misma que usan las celdas de Assignee/Supervisor) en vez de
// vivir en `QUEST_FILTERS`. Solo aplica en la tabla de un guild: la vista
// personal no tiene miembros que ofrecer, así que su caller simplemente omite
// estas entradas ahí. Compartida por `createAssigneeFilterDef` y
// `createSupervisorFilterDef` — misma forma para ambos campos de asignación,
// igual que `createAssignmentColumn` comparte una sola implementación
// parametrizada por `field` para las columnas de la tabla.
function createMemberFilterDef(
  field: 'assigneeId' | 'supervisorId',
  label: string,
  members: readonly MemberOption[],
): DataTableFilterDef {
  // Del contrato del slot `icon` se reenvía `aria-hidden` (el avatar es
  // decorativo en la lista: el nombre ya va al lado como texto, y sin esto el
  // fallback de iniciales se anunciaría dos veces). `className` NO se reenvía
  // a propósito: trae sizing de Lucide (`size-3.5`) y el avatar fija el suyo
  // con `size="xs"` para igualar el de los avatares reales.
  const memberIcon =
    (member: MemberOption | null) =>
    ({ 'aria-hidden': ariaHidden }: DataTableFilterOptionIconProps) => (
      <MemberAvatarOrPlaceholder
        member={member}
        size="xs"
        aria-hidden={ariaHidden}
      />
    )

  return {
    id: field,
    columnId: field,
    label,
    options: [
      {
        value: UNASSIGNED_VALUE,
        label: 'Unassigned',
        icon: memberIcon(null),
      },
      ...members.map((member, index) => ({
        value: member.userId,
        label: member.name ?? 'Unknown member',
        icon: memberIcon(member),
        // Separador antes del primer miembro real: distingue visualmente el
        // grupo "Unassigned" del listado de miembros que le sigue.
        separatorBefore: index === 0,
      })),
    ],
  }
}

export function createAssigneeFilterDef(
  members: readonly MemberOption[],
): DataTableFilterDef {
  return createMemberFilterDef('assigneeId', 'Assignee', members)
}

export function createSupervisorFilterDef(
  members: readonly MemberOption[],
): DataTableFilterDef {
  return createMemberFilterDef('supervisorId', 'Supervisor', members)
}

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
    // `row.original[field]` (no `getValue`, que pasa por el accessor de arriba
    // y ya convirtió `null` en `undefined`) para comparar contra el centinela
    // de "sin asignar" con el mismo criterio que usa `MemberSelect`.
    filterFn: (row, _columnId, filterValue: string[]) =>
      matchesMultiSelectFilter(
        filterValue,
        row.original[field] ?? UNASSIGNED_VALUE,
      ),
  }
}

// ─── Permisos ─────────────────────────────────────────────────────────────────

/**
 * Predicados de permiso para las quests de una tabla — misma fuente que usan
 * las columnas y el drawer de detalle, así que nunca se desincronizan entre sí.
 * Sin contexto de guild (vista personal) todo es editable: las quests
 * personales siempre pertenecen a quien las ve.
 */
export function getQuestPermissions(guildContext?: QuestsColumnsGuildContext) {
  return {
    canManage: (quest: Quest) =>
      guildContext ? guildContext.canManageQuest(quest) : true,
    canEditStatus: (quest: Quest) =>
      guildContext ? guildContext.canUpdateQuestStatus(quest) : true,
  }
}

// ─── Factory de columnas ──────────────────────────────────────────────────────

/**
 * Crea las definiciones de columnas para la tabla de quests.
 * @param onUpdate - Callback invocado cuando el usuario confirma una edición inline.
 * @param guildContext - Si se provee, añade las columnas de asignado/supervisor.
 * @param onOpenDetails - Callback invocado al hacer clic en el trigger de detalle de una fila.
 */
export function createQuestsColumns(
  onUpdate: (data: UpdateQuestValues) => void,
  guildContext?: QuestsColumnsGuildContext,
  onOpenDetails?: (quest: Quest) => void,
): ColumnDef<Quest>[] {
  const { canManage, canEditStatus } = getQuestPermissions(guildContext)

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

    // Title (editable inline, una sola línea — la descripción completa solo
    // vive en el drawer de detalle, no en la tabla). El trigger del drawer
    // vive dentro de esta misma celda, tras el título — estilo Notion
    // ("ABRIR" en el hover de fila) — en vez de una columna dedicada. Ocupa un
    // slot de ancho fijo (shrink-0) siempre presente en el layout para que el
    // truncado del título no salte al aparecer/desaparecer con el hover.
    {
      accessorKey: 'title',
      header: () => <ColumnHeader icon={ScrollText}>Quest</ColumnHeader>,
      size: 256,
      minSize: 220,
      cell: ({ row }) => {
        const quest = row.original
        const { id, title } = quest
        return (
          <div className="flex min-w-0 items-center gap-1">
            <InlineEditTitle
              value={title}
              onSave={(newTitle) => onUpdate({ id, title: newTitle })}
              readOnly={!canManage(quest)}
              className="min-w-0 flex-1"
            />
            <Tooltip content="Open" side="top">
              <Button
                type="button"
                variant="secondary"
                size="icon-sm"
                aria-label={`Open details: ${title}`}
                {...{ [QUEST_OPEN_TRIGGER_ATTR]: 'true' }}
                className="shrink-0 opacity-0 transition-opacity group-hover/row:opacity-100 group-focus-within/row:opacity-100 focus-visible:opacity-100"
                onClick={(event) => {
                  event.stopPropagation()
                  onOpenDetails?.(quest)
                }}
              >
                <PanelRightOpen className="size-4" aria-hidden="true" />
              </Button>
            </Tooltip>
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
      filterFn: multiSelectFilterFn,
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
      filterFn: multiSelectFilterFn,
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
