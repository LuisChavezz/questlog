/**
 * DataTable — componente de tabla reutilizable basado en TanStack Table.
 * Incluye: ordenamiento por columna, filtro global, paginación, selección
 * y redimensionado de columnas.
 */
import * as React from 'react'
import type {
  ColumnDef,
  ColumnFiltersState,
  ColumnSizingState,
  Header,
  Row,
  RowData,
  RowSelectionState,
  SortingState,
  Table,
  VisibilityState,
} from '@tanstack/react-table'
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { ChevronDown, ChevronUp, ChevronsUpDown } from 'lucide-react'

import {
  DataTableBulkActionsBar,
  DATA_TABLE_SELECTION_PRESERVE_ATTR,
  getDataTableSelectionBoundaryProps,
} from '#/components/ui/data-table-bulk-actions'
import type {
  DataTableBulkAction,
  DataTableSelectionBoundaryProps,
} from '#/components/ui/data-table-bulk-actions'
import { DataTablePagination } from '#/components/ui/data-table-pagination'
import { DataTableSkeleton } from '#/components/ui/data-table-skeleton'
import { DataTableToolbar } from '#/components/ui/data-table-toolbar'
import { cn } from '#/lib/utils'

interface DataTableProps<TData extends RowData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  filterPlaceholder?: string
  defaultPageSize?: number
  className?: string
  isLoading?: boolean
  onRowSelectionChange?: (selection: RowSelectionState) => void
  getRowId?: (originalRow: TData, index: number, parent?: Row<TData>) => string
  stateStorageKey?: string
  enableColumnResizing?: boolean
  bulkActions?: DataTableBulkAction<TData>[]
  /** Slot derecho de la toolbar: acciones como botones de creación, filtros, etc. */
  actions?: React.ReactNode
}

interface PersistedColumnSizing {
  columnSizing: ColumnSizingState
}

interface HeaderCellProps<TData extends RowData> {
  header: Header<TData, unknown>
  table: Table<TData>
  selectionBoundaryProps?: DataTableSelectionBoundaryProps
}

export function DataTable<TData extends RowData, TValue>({
  columns,
  data,
  filterPlaceholder = 'Filter...',
  defaultPageSize = 10,
  className,
  isLoading = false,
  onRowSelectionChange,
  getRowId,
  stateStorageKey,
  enableColumnResizing = true,
  bulkActions = [],
  actions,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [globalFilter, setGlobalFilter] = React.useState('')
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({})
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({})
  const [columnSizing, setColumnSizing] = React.useState<ColumnSizingState>({})
  const [isLayoutHydrated, setIsLayoutHydrated] = React.useState(!stateStorageKey)

  const leafColumnIds = React.useMemo(() => getLeafColumnIds(columns), [columns])
  const selectionBoundaryProps = React.useMemo(
    () => getDataTableSelectionBoundaryProps(),
    [],
  )

  const handleRowSelectionChange = React.useCallback(
    (updater: React.SetStateAction<RowSelectionState>) => {
      setRowSelection((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater
        onRowSelectionChange?.(next)
        return next
      })
    },
    [onRowSelectionChange],
  )

  const clearRowSelection = React.useCallback(() => {
    handleRowSelectionChange({})
  }, [handleRowSelectionChange])

  React.useEffect(() => {
    setColumnSizing((current) => {
      const next = normalizeColumnSizing(current, leafColumnIds)
      return areColumnSizingStatesEqual(current, next) ? current : next
    })
  }, [leafColumnIds])

  React.useEffect(() => {
    if (!stateStorageKey || typeof window === 'undefined') return

    const persistedSizing = readPersistedColumnSizing(stateStorageKey)

    if (persistedSizing) {
      setColumnSizing(normalizeColumnSizing(persistedSizing.columnSizing, leafColumnIds))
    }

    setIsLayoutHydrated(true)
  }, [leafColumnIds, stateStorageKey])

  React.useEffect(() => {
    if (!stateStorageKey || !isLayoutHydrated || typeof window === 'undefined') {
      return
    }

    const timeoutId = window.setTimeout(() => {
      writePersistedColumnSizing(stateStorageKey, {
        columnSizing: normalizeColumnSizing(columnSizing, leafColumnIds),
      })
    }, 150)

    return () => window.clearTimeout(timeoutId)
  }, [columnSizing, isLayoutHydrated, leafColumnIds, stateStorageKey])

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnFilters,
      globalFilter,
      columnVisibility,
      rowSelection,
      columnSizing,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: handleRowSelectionChange,
    onColumnSizingChange: setColumnSizing,
    getRowId,
    enableRowSelection: true,
    enableColumnResizing,
    columnResizeMode: 'onChange',
    defaultColumn: {
      minSize: 96,
      size: 160,
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: defaultPageSize } },
  })

  const visibleColumnCount = Math.max(table.getVisibleLeafColumns().length, 1)
  const tableWidth = Math.max(table.getTotalSize(), 0)
  const isResizing = Boolean(table.getState().columnSizingInfo.isResizingColumn)
  const selectedRows = table.getSelectedRowModel().rows
  const selectedCount = selectedRows.length
  const bulkActionContext = React.useMemo(
    () => ({
      table,
      rows: selectedRows,
      items: selectedRows.map((row) => row.original),
      selectedCount,
      clearSelection: clearRowSelection,
      selectionBoundaryProps,
    }),
    [clearRowSelection, selectedCount, selectedRows, selectionBoundaryProps, table],
  )
  const toolbarLeadingContent = selectedCount > 0 ? (
    <DataTableBulkActionsBar
      actions={bulkActions}
      actionContext={bulkActionContext}
      className="max-w-full"
    />
  ) : undefined

  React.useEffect(() => {
    if (selectedCount === 0 || typeof document === 'undefined') {
      return
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target

      if (!(target instanceof Element)) {
        return
      }

      if (target.closest(`[${DATA_TABLE_SELECTION_PRESERVE_ATTR}]`)) {
        return
      }

      clearRowSelection()
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        clearRowSelection()
      }
    }

    document.addEventListener('pointerdown', handlePointerDown, true)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [clearRowSelection, selectedCount])

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      <DataTableToolbar
        table={table}
        filterPlaceholder={filterPlaceholder}
        leadingContent={toolbarLeadingContent}
        actions={actions}
      />

      <div
        className="overflow-hidden rounded-xl border border-border bg-card shadow-xs"
        data-resizing={isResizing ? 'true' : undefined}
      >
        <div className="overflow-x-auto data-[resizing=true]:cursor-col-resize data-[resizing=true]:select-none">
          <table
            className="min-w-full table-fixed text-sm"
            style={{ width: tableWidth || undefined }}
          >
            <thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr
                  key={headerGroup.id}
                  className="border-b border-border bg-muted/40"
                >
                  {headerGroup.headers.map((header) => (
                    <DataTableHeaderCell
                      key={header.id}
                      header={header}
                      table={table}
                      selectionBoundaryProps={selectionBoundaryProps}
                    />
                  ))}
                </tr>
              ))}
            </thead>

            <tbody>
              {isLoading ? (
                <DataTableSkeleton
                  columns={visibleColumnCount}
                  rows={defaultPageSize}
                />
              ) : table.getRowModel().rows.length ? (
                table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    data-state={row.getIsSelected() ? 'selected' : undefined}
                    className="group/row border-b border-border transition-colors last:border-0 hover:bg-muted/30 data-[state=selected]:bg-primary/5"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        className={cn(
                          'py-3 align-middle',
                          cell.column.id === 'select' ? 'px-3 text-center' : 'px-4',
                        )}
                        style={{ width: cell.column.getSize() }}
                      >
                        {isSelectionColumn(cell.column.id) ? (
                          <SelectionVisibilityContainer
                            isVisible={row.getIsSelected()}
                            boundaryProps={selectionBoundaryProps}
                            revealOnHoverClassName="group-hover/row:opacity-100 group-hover/row:pointer-events-auto"
                          >
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </SelectionVisibilityContainer>
                        ) : (
                          flexRender(cell.column.columnDef.cell, cell.getContext())
                        )}
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={visibleColumnCount}
                    className="h-32 text-center text-muted-foreground"
                  >
                    No results found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <DataTablePagination table={table} />
    </div>
  )
}

interface ColumnHeaderProps {
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
  children: React.ReactNode
}

export function ColumnHeader({ icon: Icon, children }: ColumnHeaderProps) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Icon
        className="size-3.5 shrink-0 opacity-60"
        aria-hidden="true"
      />
      {children}
    </span>
  )
}

function DataTableHeaderCell<TData extends RowData>({
  header,
  table,
  selectionBoundaryProps,
}: HeaderCellProps<TData>) {
  return (
    <th
      className={getHeaderCellClassName(header.column.id)}
      style={{ width: header.getSize() }}
    >
      <HeaderCellInner
        header={header}
        table={table}
        selectionBoundaryProps={selectionBoundaryProps}
      />
    </th>
  )
}

function HeaderCellInner<TData extends RowData>({
  header,
  table,
  selectionBoundaryProps,
}: HeaderCellProps<TData>) {
  if (header.isPlaceholder) {
    return null
  }

  const isSelectColumn = isSelectionColumn(header.column.id)
  const hasSelectedRows = hasTableSelection(table)
  const headerContent = (
    <SortableHeader
      canSort={header.column.getCanSort()}
      isSorted={header.column.getIsSorted()}
      onSort={header.column.getToggleSortingHandler()}
    >
      {flexRender(header.column.columnDef.header, header.getContext())}
    </SortableHeader>
  )

  return (
    <div
      className={cn(
        'group/header relative flex min-w-0 items-center gap-2',
        header.column.id === 'select' ? 'justify-center' : 'pr-3',
      )}
    >
      <div className={cn('min-w-0 flex-1', header.column.id === 'select' && 'flex justify-center')}>
        {isSelectColumn ? (
          <SelectionVisibilityContainer
            isVisible={hasSelectedRows}
            boundaryProps={selectionBoundaryProps}
            revealOnHoverClassName="group-hover/select-header:opacity-100 group-hover/select-header:pointer-events-auto"
          >
            {headerContent}
          </SelectionVisibilityContainer>
        ) : (
          headerContent
        )}
      </div>

      {header.column.getCanResize() ? (
        <ColumnResizeHandle header={header} table={table} />
      ) : null}
    </div>
  )
}

function ColumnResizeHandle<TData extends RowData>({
  header,
  table,
}: HeaderCellProps<TData>) {
  const resizeByStep = React.useCallback(
    (step: number) => {
      const nextSize = clampColumnSize(
        header.column.getSize() + step,
        header.column.columnDef.minSize,
        header.column.columnDef.maxSize,
      )

      table.setColumnSizing((current) => ({
        ...current,
        [header.column.id]: nextSize,
      }))
    },
    [header, table],
  )

  return (
    <button
      type="button"
      aria-label={`Resize ${header.column.id} column`}
      className={cn(
        'absolute inset-y-1 -right-2 z-10 w-4 cursor-col-resize touch-none rounded-sm outline-none transition-colors',
        'before:absolute before:inset-y-1 before:left-1/2 before:w-px before:-translate-x-1/2 before:bg-border/70 before:transition-colors',
        'hover:before:bg-primary/70 focus-visible:ring-2 focus-visible:ring-ring/50',
        header.column.getIsResizing() && 'before:bg-primary',
      )}
      onDoubleClick={() => header.column.resetSize()}
      onKeyDown={(event) => {
        if (event.key === 'ArrowLeft') {
          event.preventDefault()
          resizeByStep(-16)
        }

        if (event.key === 'ArrowRight') {
          event.preventDefault()
          resizeByStep(16)
        }

        if (event.key === 'Home') {
          event.preventDefault()
          header.column.resetSize()
        }
      }}
      onMouseDown={header.getResizeHandler()}
      onTouchStart={header.getResizeHandler()}
    />
  )
}

interface SortableHeaderProps {
  canSort: boolean
  isSorted: false | 'asc' | 'desc'
  onSort?: React.MouseEventHandler<HTMLButtonElement>
  children: React.ReactNode
}

interface SelectionVisibilityContainerProps {
  isVisible: boolean
  boundaryProps?: DataTableSelectionBoundaryProps
  revealOnHoverClassName: string
  children: React.ReactNode
}

function SelectionVisibilityContainer({
  isVisible,
  boundaryProps,
  revealOnHoverClassName,
  children,
}: SelectionVisibilityContainerProps) {
  return (
    <div
      {...boundaryProps}
      className={cn(
        'flex w-full items-center justify-center transition-opacity duration-150 ease-out motion-reduce:transition-none',
        isVisible
          ? 'opacity-100 pointer-events-auto'
          : cn(
            'opacity-0 pointer-events-none focus-within:opacity-100 focus-within:pointer-events-auto',
            revealOnHoverClassName,
          ),
      )}
    >
      {children}
    </div>
  )
}

function SortableHeader({
  canSort,
  isSorted,
  onSort,
  children,
}: SortableHeaderProps) {
  if (!canSort) {
    return <span className="inline-flex min-w-0 items-center gap-1.5">{children}</span>
  }

  return (
    <button
      onClick={onSort}
      className="inline-flex min-w-0 items-center gap-1.5 text-left transition-colors hover:text-foreground"
    >
      <span className="min-w-0 truncate">{children}</span>
      <span className="shrink-0 text-muted-foreground/50 transition-colors group-hover/header:text-muted-foreground">
        {isSorted === 'asc' ? (
          <ChevronUp className="size-3.5" />
        ) : isSorted === 'desc' ? (
          <ChevronDown className="size-3.5" />
        ) : (
          <ChevronsUpDown className="size-3.5" />
        )}
      </span>
    </button>
  )
}

function getHeaderCellClassName(columnId: string) {
  return cn(
    'relative py-3 align-middle font-medium text-muted-foreground whitespace-nowrap',
    isSelectionColumn(columnId) && 'group/select-header',
    columnId === 'select' ? 'px-3 text-center' : 'px-4 text-left',
  )
}

function isSelectionColumn(columnId: string) {
  return columnId === 'select'
}

function hasTableSelection<TData extends RowData>(table: Table<TData>) {
  return Object.keys(table.getState().rowSelection).length > 0
}

function getLeafColumnIds<TData extends RowData, TValue>(
  columns: ColumnDef<TData, TValue>[],
): string[] {
  return columns.flatMap((column) => {
    const nestedColumns = 'columns' in column ? column.columns : undefined

    if (nestedColumns?.length) {
      return getLeafColumnIds(nestedColumns)
    }

    if (typeof column.id === 'string') {
      return [column.id]
    }

    if ('accessorKey' in column && typeof column.accessorKey === 'string') {
      return [column.accessorKey]
    }

    return []
  })
}

function normalizeColumnSizing(
  currentSizing: ColumnSizingState,
  availableColumnIds: readonly string[],
) {
  const availableIds = new Set(availableColumnIds)

  return Object.fromEntries(
    Object.entries(currentSizing).filter(([columnId, size]) => (
      availableIds.has(columnId)
        && Number.isFinite(size)
        && size > 0
    )),
  )
}

function areColumnSizingStatesEqual(
  current: ColumnSizingState,
  next: ColumnSizingState,
) {
  const currentEntries = Object.entries(current)
  const nextEntries = Object.entries(next)

  if (currentEntries.length !== nextEntries.length) return false

  return currentEntries.every(([columnId, size]) => next[columnId] === size)
}

function clampColumnSize(
  nextSize: number,
  minSize?: number,
  maxSize?: number,
) {
  const resolvedMinSize = minSize ?? 96
  const resolvedMaxSize = maxSize ?? Number.POSITIVE_INFINITY

  return Math.min(Math.max(nextSize, resolvedMinSize), resolvedMaxSize)
}

function readPersistedColumnSizing(
  stateStorageKey: string,
): PersistedColumnSizing | null {
  try {
    const rawValue = window.localStorage.getItem(
      getPersistedColumnSizingKey(stateStorageKey),
    )

    if (!rawValue) return null

    const parsedValue = JSON.parse(rawValue) as Partial<PersistedColumnSizing>

    return {
      columnSizing: parsedValue.columnSizing != null && typeof parsedValue.columnSizing === 'object'
        ? Object.fromEntries(
          Object.entries(parsedValue.columnSizing).filter(([, size]) => (
            typeof size === 'number' && Number.isFinite(size)
          )),
        )
        : {},
    }
  } catch {
    return null
  }
}

function writePersistedColumnSizing(
  stateStorageKey: string,
  value: PersistedColumnSizing,
) {
  try {
    window.localStorage.setItem(
      getPersistedColumnSizingKey(stateStorageKey),
      JSON.stringify(value),
    )
  } catch {
    return
  }
}

function getPersistedColumnSizingKey(stateStorageKey: string) {
  return `data-table:${stateStorageKey}:column-sizing`
}
