/**
 * Definición de columnas para la tabla de quests.
 * Separado del componente para facilitar el testing y la reutilización.
 */
import type { ColumnDef } from '@tanstack/react-table'
import {
  AlertCircle,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  CheckCircle2,
  Circle,
  Clock,
  MinusCircle,
  XCircle,
} from 'lucide-react'

import { cn } from '#/lib/utils'
import { Badge } from '#/components/ui/badge'
import type { Quest, QuestPriority, QuestStatus } from '#/db/schema'

// ─── Utilidad de formato de fecha ─────────────────────────────────────────────

const dateFormatter = new Intl.DateTimeFormat('en', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

// ─── Mapas de metadatos para estados y prioridades ────────────────────────────

const STATUS_META: Record<
  QuestStatus,
  { label: string; icon: React.ElementType; variant: QuestStatus }
> = {
  backlog: { label: 'Backlog', icon: Circle, variant: 'backlog' },
  todo: { label: 'To Do', icon: Clock, variant: 'todo' },
  in_progress: { label: 'In Progress', icon: ArrowRight, variant: 'in_progress' },
  done: { label: 'Completed', icon: CheckCircle2, variant: 'done' },
  cancelled: { label: 'Cancelled', icon: XCircle, variant: 'cancelled' },
}

const PRIORITY_META: Record<
  QuestPriority,
  { label: string; icon: React.ElementType; variant: QuestPriority }
> = {
  low: { label: 'Low', icon: ArrowDown, variant: 'low' },
  medium: { label: 'Medium', icon: MinusCircle, variant: 'medium' },
  high: { label: 'High', icon: ArrowUp, variant: 'high' },
  urgent: { label: 'Urgent', icon: AlertCircle, variant: 'urgent' },
}

// ─── Columnas ─────────────────────────────────────────────────────────────────

export const questsColumns: ColumnDef<Quest>[] = [
  // Title + description
  {
    accessorKey: 'title',
    header: 'Quest',
    size: 320,
    cell: ({ row }) => {
      const { title, description } = row.original
      return (
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="font-medium text-foreground truncate">{title}</span>
          {description && (
            <span className="text-xs text-muted-foreground line-clamp-1 max-w-xs">
              {description}
            </span>
          )}
        </div>
      )
    },
  },

  // Status
  {
    accessorKey: 'status',
    header: 'Status',
    size: 140,
    cell: ({ getValue }) => {
      const status = getValue<QuestStatus>()
      const meta = STATUS_META[status]
      const Icon = meta.icon
      return (
        <Badge variant={meta.variant}>
          <Icon className="size-3" />
          {meta.label}
        </Badge>
      )
    },
    filterFn: (row, _columnId, filterValue: string[]) =>
      filterValue.length === 0 || filterValue.includes(row.getValue('status')),
  },

  // Priority
  {
    accessorKey: 'priority',
    header: 'Priority',
    size: 120,
    cell: ({ getValue }) => {
      const priority = getValue<QuestPriority>()
      const meta = PRIORITY_META[priority]
      const Icon = meta.icon
      return (
        <Badge variant={meta.variant}>
          <Icon className="size-3" />
          {meta.label}
        </Badge>
      )
    },
  },

  // Tags
  {
    accessorKey: 'tags',
    header: 'Tags',
    size: 200,
    enableSorting: false,
    cell: ({ getValue }) => {
      const tags = getValue<string[]>()
      if (!tags.length) return <span className="text-muted-foreground/50">—</span>
      return (
        <div className="flex flex-wrap gap-1">
          {tags.map((tag) => (
            <Badge key={tag} variant="outline" className="text-xs py-0">
              {tag}
            </Badge>
          ))}
        </div>
      )
    },
  },

  // Due date
  {
    accessorKey: 'dueDate',
    header: 'Due Date',
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

  // Created
  {
    accessorKey: 'createdAt',
    header: 'Created',
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

