import * as React from 'react'
import type { Row, RowData, Table } from '@tanstack/react-table'
import { ChevronDown, X } from 'lucide-react'

import { Button } from '#/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import { cn } from '#/lib/utils'

export const DATA_TABLE_SELECTION_PRESERVE_ATTR = 'data-selection-preserve' as const

export type DataTableSelectionBoundaryProps = Record<
  typeof DATA_TABLE_SELECTION_PRESERVE_ATTR,
  'true'
>

export type DataTableBulkActionIcon = React.ElementType

export interface DataTableBulkActionContext<TData extends RowData> {
  table: Table<TData>
  rows: Row<TData>[]
  items: TData[]
  selectedCount: number
  clearSelection: () => void
  selectionBoundaryProps: DataTableSelectionBoundaryProps
}

export interface DataTableBulkMenuOption {
  value: string
  label: string
  icon?: DataTableBulkActionIcon
  variant?: 'default' | 'destructive'
}

type DataTableBulkActionDisabled<TData extends RowData> =
  | boolean
  | ((context: DataTableBulkActionContext<TData>) => boolean)

interface DataTableBulkActionBase<TData extends RowData> {
  id: string
  label: string
  icon?: DataTableBulkActionIcon
  disabled?: DataTableBulkActionDisabled<TData>
}

export interface DataTableBulkButtonAction<TData extends RowData>
  extends DataTableBulkActionBase<TData> {
  kind?: 'button'
  variant?: 'ghost' | 'outline' | 'destructive'
  onClick: (context: DataTableBulkActionContext<TData>) => void | Promise<void>
}

export interface DataTableBulkMenuAction<TData extends RowData>
  extends DataTableBulkActionBase<TData> {
  kind: 'menu'
  options: readonly DataTableBulkMenuOption[]
  onSelect: (
    value: string,
    context: DataTableBulkActionContext<TData>,
  ) => void | Promise<void>
}

export interface DataTableBulkCustomAction<TData extends RowData> {
  id: string
  kind: 'custom'
  render: (context: DataTableBulkActionContext<TData>) => React.ReactNode
}

export type DataTableBulkAction<TData extends RowData> =
  | DataTableBulkButtonAction<TData>
  | DataTableBulkMenuAction<TData>
  | DataTableBulkCustomAction<TData>

interface DataTableBulkActionsBarProps<TData extends RowData> {
  actions: readonly DataTableBulkAction<TData>[]
  actionContext: DataTableBulkActionContext<TData>
  className?: string
}

export function DataTableBulkActionsBar<TData extends RowData>({
  actions,
  actionContext,
  className,
}: DataTableBulkActionsBarProps<TData>) {
  const [pendingActionId, setPendingActionId] = React.useState<string | null>(null)

  const runAction = React.useCallback(
    async (actionId: string, handler: () => void | Promise<void>) => {
      setPendingActionId(actionId)

      try {
        await handler()
      } finally {
        setPendingActionId((current) => (current === actionId ? null : current))
      }
    },
    [],
  )

  if (actionContext.selectedCount === 0) {
    return null
  }

  return (
    <div
      {...actionContext.selectionBoundaryProps}
      role="toolbar"
      aria-label="Bulk actions"
      aria-busy={pendingActionId !== null}
      className={cn(
        'flex min-h-8 min-w-0 max-w-full items-center gap-1.5 overflow-x-auto rounded-lg border border-border/65 bg-muted/30 px-2 py-1 shadow-xs',
        'transition-[opacity,transform,border-color,background-color,box-shadow] duration-150 ease-out',
        className,
      )}
    >
      <span className="shrink-0 text-sm font-medium text-foreground tabular-nums">
        {actionContext.selectedCount} selected
      </span>

      <div className="h-4 w-px shrink-0 bg-border/70" />

      <div className="flex min-w-0 items-center gap-1">
        {actions.map((action) => renderBulkAction(action, actionContext, pendingActionId, runAction))}
      </div>

      <div className="h-4 w-px shrink-0 bg-border/70" />

      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={actionContext.clearSelection}
        aria-label="Clear selection"
        className="size-7 shrink-0 rounded-md text-muted-foreground hover:text-foreground"
      >
        <X className="size-3.5" aria-hidden="true" />
      </Button>
    </div>
  )
}

export function getDataTableSelectionBoundaryProps(): DataTableSelectionBoundaryProps {
  return {
    [DATA_TABLE_SELECTION_PRESERVE_ATTR]: 'true',
  }
}

function renderBulkAction<TData extends RowData>(
  action: DataTableBulkAction<TData>,
  actionContext: DataTableBulkActionContext<TData>,
  pendingActionId: string | null,
  runAction: (actionId: string, handler: () => void | Promise<void>) => Promise<void>,
) {
  if (action.kind === 'custom') {
    return <React.Fragment key={action.id}>{action.render(actionContext)}</React.Fragment>
  }

  const isDisabled = pendingActionId !== null || resolveActionDisabled(action.disabled, actionContext)
  const ActionIcon = action.icon

  if (action.kind === 'menu') {
    return (
      <DropdownMenu key={action.id}>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={isDisabled}
            className="h-7 rounded-md px-2.5 text-xs font-medium text-foreground hover:bg-accent/70"
          >
            {ActionIcon ? <ActionIcon className="size-3.5 text-muted-foreground" aria-hidden="true" /> : null}
            <span>{action.label}</span>
            <ChevronDown className="size-3 text-muted-foreground" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="start"
          className="w-48"
          {...actionContext.selectionBoundaryProps}
        >
          {action.options.map((option) => {
            const OptionIcon = option.icon

            return (
              <DropdownMenuItem
                key={option.value}
                variant={option.variant}
                onSelect={() => {
                  void runAction(action.id, () => action.onSelect(option.value, actionContext)).catch(() => undefined)
                }}
              >
                {OptionIcon ? <OptionIcon className="size-3.5" aria-hidden="true" /> : null}
                <span>{option.label}</span>
              </DropdownMenuItem>
            )
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  return (
    <Button
      key={action.id}
      type="button"
      variant={action.variant ?? 'ghost'}
      size="sm"
      disabled={isDisabled}
      onClick={() => {
        void runAction(action.id, () => action.onClick(actionContext)).catch(() => undefined)
      }}
      className="h-7 rounded-md px-2.5 text-xs font-medium"
    >
      {ActionIcon ? <ActionIcon className="size-3.5" aria-hidden="true" /> : null}
      <span>{action.label}</span>
    </Button>
  )
}

function resolveActionDisabled<TData extends RowData>(
  disabled: DataTableBulkActionDisabled<TData> | undefined,
  actionContext: DataTableBulkActionContext<TData>,
) {
  if (typeof disabled === 'function') {
    return disabled(actionContext)
  }

  return disabled ?? false
}