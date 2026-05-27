/**
 * Definición de columnas para la tabla de quests.
 * Exporta createQuestsColumns — función factory que recibe el callback de
 * actualización y devuelve las columnas con soporte de edición inline.
 * También exporta questsColumns como instancia estática para el skeleton.
 */
import type { ColumnDef } from '@tanstack/react-table'
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
  Flag,
  MinusCircle,
  ScrollText,
  Tag,
  XCircle,
} from 'lucide-react'

import { ColumnHeader } from '#/components/ui/data-table'

import { cn } from '#/lib/utils'
import type { Quest, QuestPriority, QuestStatus } from '#/db/schema'
import type { UpdateQuestValues } from '../schemas/quest-schemas'
import { InlineEditTitle } from './inline-edit-title'
import type { BadgeOption } from './inline-edit-badge'
import { InlineEditBadge } from './inline-edit-badge'
import { InlineEditTags } from './inline-edit-tags'

// ─── Utilidad de formato de fecha ─────────────────────────────────────────────

const dateFormatter = new Intl.DateTimeFormat('en', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

// ─── Opciones de estado y prioridad ───────────────────────────────────────────

export const STATUS_OPTIONS: readonly BadgeOption[] = [
  { value: 'backlog', label: 'Backlog', icon: Circle, variant: 'backlog' },
  { value: 'todo', label: 'To Do', icon: Clock, variant: 'todo' },
  { value: 'in_progress', label: 'In Progress', icon: ArrowRight, variant: 'in_progress' },
  { value: 'done', label: 'Completed', icon: CheckCircle2, variant: 'done' },
  { value: 'cancelled', label: 'Cancelled', icon: XCircle, variant: 'cancelled' },
] as const

export const PRIORITY_OPTIONS: readonly BadgeOption[] = [
  { value: 'low', label: 'Low', icon: ArrowDown, variant: 'low' },
  { value: 'medium', label: 'Medium', icon: MinusCircle, variant: 'medium' },
  { value: 'high', label: 'High', icon: ArrowUp, variant: 'high' },
  { value: 'critical', label: 'Critical', icon: AlertCircle, variant: 'critical' },
] as const

// ─── Factory de columnas ──────────────────────────────────────────────────────

/**
 * Crea las definiciones de columnas para la tabla de quests.
 * @param onUpdate - Callback invocado cuando el usuario confirma una edición inline.
 */
export function createQuestsColumns(
  onUpdate: (data: UpdateQuestValues) => void,
): ColumnDef<Quest>[] {
  return [
    // Title + description (título editable inline)
    {
      accessorKey: 'title',
      header: () => <ColumnHeader icon={ScrollText}>Quest</ColumnHeader>,
      size: 320,
      cell: ({ row }) => {
        const { id, title, description } = row.original
        return (
          <div className="flex flex-col gap-0.5 min-w-0">
            <InlineEditTitle
              value={title}
              onSave={(newTitle) => onUpdate({ id, title: newTitle })}
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
      cell: ({ row }) => {
        const { id, status } = row.original
        return (
          <InlineEditBadge
            value={status}
            options={STATUS_OPTIONS}
            onSave={(newStatus) => onUpdate({ id, status: newStatus as QuestStatus })}
            label="status"
          />
        )
      },
      filterFn: (row, _columnId, filterValue: string[]) =>
        filterValue.length === 0 || filterValue.includes(row.getValue('status')),
    },

    // Priority (badge editable inline)
    {
      accessorKey: 'priority',
      header: () => <ColumnHeader icon={Flag}>Priority</ColumnHeader>,
      size: 120,
      cell: ({ row }) => {
        const { id, priority } = row.original
        return (
          <InlineEditBadge
            value={priority}
            options={PRIORITY_OPTIONS}
            onSave={(newPriority) => onUpdate({ id, priority: newPriority as QuestPriority })}
            label="priority"
          />
        )
      },
    },

    // Tags (editable inline)
    {
      accessorKey: 'tags',
      header: () => <ColumnHeader icon={Tag}>Tags</ColumnHeader>,
      size: 200,
      enableSorting: false,
      cell: ({ row }) => {
        const { id, tags } = row.original
        return (
          <InlineEditTags
            value={tags}
            onSave={(newTags) => onUpdate({ id, tags: newTags })}
          />
        )
      },
    },

    // Due date (solo lectura)
    {
      accessorKey: 'dueDate',
      header: () => <ColumnHeader icon={Calendar}>Due Date</ColumnHeader>,
      size: 130,
      cell: ({ getValue }) => {
        const date = getValue<Date | null>()
        if (!date) return <span className="text-muted-foreground/50">—</span>
        const d = new Date(date)
        const isOverdue = d < new Date()
        return (
          <span
            className={cn(
              'text-sm tabular-nums',
              isOverdue ? 'text-destructive' : 'text-muted-foreground',
            )}
          >
            {dateFormatter.format(d)}
          </span>
        )
      },
    },

    // Created (solo lectura)
    {
      accessorKey: 'createdAt',
      header: () => <ColumnHeader icon={Clock}>Created</ColumnHeader>,
      size: 120,
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

// Instancia estática sin callbacks — usada exclusivamente para el skeleton de carga
export const questsColumns = createQuestsColumns(() => {})

