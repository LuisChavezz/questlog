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
import { DataTableFilterBar } from '#/components/ui/data-table-filter'
import type { DataTableFilterDef } from '#/components/ui/data-table-filter'
import { DataTablePagination } from '#/components/ui/data-table-pagination'
import {
  DataTableSkeleton,
  STICKY_LEADING_BORDER_CLASS,
} from '#/components/ui/data-table-skeleton'
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
  /**
   * Habilita la selección de filas. `true` (por defecto) todas; un predicado
   * permite gatear por fila — TanStack respeta `getCanSelect()` también en el
   * "seleccionar todo" del header y en las acciones masivas.
   */
  enableRowSelection?: boolean | ((row: Row<TData>) => boolean)
  bulkActions?: DataTableBulkAction<TData>[]
  /** Slot derecho de la toolbar: acciones como botones de creación, filtros, etc. */
  actions?: React.ReactNode
  /**
   * Definiciones de filtro de columna para la barra de chips + "Add filter"
   * (debajo de la toolbar). `DataTable` renderiza la `DataTableFilterBar` por
   * su cuenta a partir de esta lista — se pasa como DATOS (no como nodo ya
   * renderizado) para que el toggle de la toolbar y la fila colapsable puedan
   * decidir su visibilidad mirando `filters.length`: un elemento JSX siempre
   * es "truthy" aunque termine renderizando null, así que gatearlos por nodo
   * dejaría un botón muerto ante una lista vacía. Omitir la prop (o pasar
   * `[]`) deja la tabla sin esa UI.
   */
  filters?: readonly DataTableFilterDef[]
  /**
   * IDs de columna que se fijan (`position: sticky`) al borde izquierdo, EN
   * ORDEN de aparición, para que la identidad de la fila siga visible durante
   * el scroll horizontal. Vacío por defecto: `DataTable` es genérico y no
   * asume ninguna columna en particular — cada caller decide cuáles fijar
   * (y con qué IDs) según sus propias columnas.
   */
  stickyLeadingColumnIds?: readonly string[]
  /**
   * Filtros de columna con los que arranca la tabla — p. ej. el Status
   * precargado al llegar desde un stat card de Guild Overview vía search
   * param. Solo se usa como valor SEMILLA de `useState`: es lo que TanStack
   * Table necesita para que el chip del filtro ya aparezca activo y las filas
   * ya vengan filtradas en el primer render, sin que el usuario tenga que
   * reabrir "Add filter" a mano. Cambios posteriores a esta prop NO
   * resincronizan el estado interno (mismo criterio que cualquier valor
   * inicial de React) — este componente sigue siendo la única fuente de
   * verdad de `columnFilters` una vez montado.
   */
  initialColumnFilters?: ColumnFiltersState
}

// Referencia estable para el default de `stickyLeadingColumnIds`: un array
// literal `[]` en la firma de la función se recrea en cada render, lo que
// invalidaría el useMemo de los offsets en cada render aunque nada cambie.
const NO_STICKY_LEADING_COLUMN_IDS: readonly string[] = []

// Mismo criterio para el default de `filters`: referencia estable.
const NO_FILTER_DEFS: readonly DataTableFilterDef[] = []

// Mismo criterio para el default de `initialColumnFilters`: referencia estable.
const NO_INITIAL_COLUMN_FILTERS: ColumnFiltersState = []

interface PersistedColumnSizing {
  columnSizing: ColumnSizingState
}

interface HeaderCellProps<TData extends RowData> {
  header: Header<TData, unknown>
  table: Table<TData>
  selectionBoundaryProps?: DataTableSelectionBoundaryProps
}

// Props de columnas fijas — separadas de `HeaderCellProps` porque solo las
// necesita `DataTableHeaderCell`, no `HeaderCellInner` ni `ColumnResizeHandle`.
interface StickyLeadingCellProps {
  stickyLeadingColumnIds: readonly string[]
  stickyLeadingOffsets: Readonly<Record<string, number>>
  isLastStickyLeadingColumn: boolean
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
  enableRowSelection = true,
  bulkActions = [],
  actions,
  filters = NO_FILTER_DEFS,
  stickyLeadingColumnIds = NO_STICKY_LEADING_COLUMN_IDS,
  initialColumnFilters = NO_INITIAL_COLUMN_FILTERS,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] =
    React.useState<ColumnFiltersState>(initialColumnFilters)
  const [globalFilter, setGlobalFilter] = React.useState('')
  // Sin persistencia entre sesiones (a diferencia del ancho de columnas, que
  // sí se guarda) — arranca colapsada, EXCEPTO cuando el caller ya sembró un
  // filtro inicial (p. ej. `?status=...` desde un stat card de Guild
  // Overview): ahí arranca expandida para que el chip activo sea visible de
  // inmediato — si no, la tabla aparece silenciosamente pre-filtrada sin
  // ninguna pista de por qué faltan filas. Solo importa como valor INICIAL de
  // `useState`; una vez montada, el toggle manual de la toolbar sigue
  // funcionando igual que siempre. Vive aquí (no en el toolbar) porque
  // también decide el `gap` toolbar-tabla de más abajo.
  const [filterPanelOpen, setFilterPanelOpen] = React.useState(
    () => initialColumnFilters.length > 0,
  )
  // Con lista vacía no se renderiza barra de filtros NI su toggle en la
  // toolbar — gatear por datos (y no por un nodo, siempre "truthy") es lo que
  // evita un botón de filtros muerto sobre una fila vacía.
  const hasFilterBar = filters.length > 0
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({})
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({})
  const [columnSizing, setColumnSizing] = React.useState<ColumnSizingState>({})
  const [isLayoutHydrated, setIsLayoutHydrated] =
    React.useState(!stateStorageKey)

  const leafColumnIds = React.useMemo(
    () => getLeafColumnIds(columns),
    [columns],
  )
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
      setColumnSizing(
        normalizeColumnSizing(persistedSizing.columnSizing, leafColumnIds),
      )
    }

    setIsLayoutHydrated(true)
  }, [leafColumnIds, stateStorageKey])

  React.useEffect(() => {
    if (
      !stateStorageKey ||
      !isLayoutHydrated ||
      typeof window === 'undefined'
    ) {
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
    enableRowSelection,
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
  // Offset izquierdo (px) de cada columna fija, derivado del ancho REAL de las
  // columnas fijas que la preceden (`table.getColumn(id).getSize()`, que ya
  // incorpora `columnSizing` y el `size` del columnDef) — no un valor
  // hardcodeado, así que sigue siendo correcto si una columna fija se
  // redimensiona o si el caller configura otras columnas/anchos.
  const stickyLeadingOffsets = React.useMemo(() => {
    const offsets: Record<string, number> = {}
    let cumulativeWidth = 0

    for (const columnId of stickyLeadingColumnIds) {
      offsets[columnId] = cumulativeWidth
      cumulativeWidth += table.getColumn(columnId)?.getSize() ?? 0
    }

    return offsets
  }, [stickyLeadingColumnIds, table])
  const lastStickyLeadingColumnId =
    stickyLeadingColumnIds[stickyLeadingColumnIds.length - 1]
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
    [
      clearRowSelection,
      selectedCount,
      selectedRows,
      selectionBoundaryProps,
      table,
    ],
  )
  const toolbarLeadingContent =
    selectedCount > 0 ? (
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
    // Envoltorio puramente de passthrough para `className`: sin clases
    // propias, así el `gap` según `filterPanelOpen` (en el div interno) nunca
    // comparte grupo de conflicto con lo que el caller pase acá — `twMerge`
    // solo resuelve conflictos entre clases del MISMO elemento, así que un
    // `className="gap-2"` externo no puede pisar silenciosamente el toggle.
    <div className={className}>
      <div className="flex flex-col gap-4">
        <DataTableToolbar
          table={table}
          filterPlaceholder={filterPlaceholder}
          leadingContent={toolbarLeadingContent}
          actions={actions}
          filterPanel={
            hasFilterBar ? (
              <DataTableFilterBar
                table={table}
                filters={filters}
                filterPanelOpen={filterPanelOpen}
              />
            ) : undefined
          }
          filterPanelOpen={filterPanelOpen}
          onFilterPanelOpenChange={setFilterPanelOpen}
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
                        stickyLeadingColumnIds={stickyLeadingColumnIds}
                        stickyLeadingOffsets={stickyLeadingOffsets}
                        isLastStickyLeadingColumn={
                          header.column.id === lastStickyLeadingColumnId
                        }
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
                    stickyLeadingOffsets={stickyLeadingColumnIds.map(
                      (columnId) => stickyLeadingOffsets[columnId],
                    )}
                  />
                ) : table.getRowModel().rows.length ? (
                  table.getRowModel().rows.map((row) => (
                    <tr
                      key={row.id}
                      data-state={row.getIsSelected() ? 'selected' : undefined}
                      className="group/row border-b border-border transition-colors last:border-0 hover:bg-muted/30 data-[state=selected]:bg-primary/5"
                    >
                      {row.getVisibleCells().map((cell) => {
                        const isSticky = stickyLeadingColumnIds.includes(
                          cell.column.id,
                        )

                        return (
                          <td
                            key={cell.id}
                            className={cn(
                              'py-3 align-middle',
                              cell.column.id === 'select'
                                ? 'px-3 text-center'
                                : 'px-4',
                              // `bg-card`/hover/selected fijan el MISMO `background-color`:
                              // no se "apilan" — la que gane por especificidad
                              // reemplaza a las demás por completo. Con
                              // `bg-muted/30` (alfa parcial, mezclado con
                              // transparent) el hover REEMPLAZABA el fondo
                              // opaco por uno ~70% transparente, dejando ver el
                              // contenido scrolleado detrás — invisible sin
                              // scroll (nada distinto detrás todavía), visible
                              // en cuanto hay contenido de otra columna físicamente
                              // debajo. Se usan colores ya opacos (`color-mix`
                              // contra `--color-card`, mismo espacio `oklab` que
                              // genera Tailwind) para que el tinte de hover/selección
                              // siga leyéndose igual mientras el fondo se mantiene
                              // opaco en los tres estados.
                              isSticky &&
                                cn(
                                  'sticky z-10 bg-card',
                                  'group-hover/row:bg-[color-mix(in_oklab,var(--color-muted)_30%,var(--color-card))]',
                                  'group-data-[state=selected]/row:bg-[color-mix(in_oklab,var(--color-primary)_5%,var(--color-card))]',
                                ),
                              cell.column.id === lastStickyLeadingColumnId &&
                                STICKY_LEADING_BORDER_CLASS,
                            )}
                            style={{
                              width: cell.column.getSize(),
                              ...(isSticky
                                ? {
                                    left: stickyLeadingOffsets[cell.column.id],
                                  }
                                : undefined),
                            }}
                          >
                            {isSelectionColumn(cell.column.id) ? (
                              <SelectionVisibilityContainer
                                isVisible={row.getIsSelected()}
                                boundaryProps={selectionBoundaryProps}
                                revealOnHoverClassName="group-hover/row:opacity-100 group-hover/row:pointer-events-auto"
                              >
                                {flexRender(
                                  cell.column.columnDef.cell,
                                  cell.getContext(),
                                )}
                              </SelectionVisibilityContainer>
                            ) : (
                              flexRender(
                                cell.column.columnDef.cell,
                                cell.getContext(),
                              )
                            )}
                          </td>
                        )
                      })}
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
      <Icon className="size-3.5 shrink-0 opacity-60" aria-hidden="true" />
      {children}
    </span>
  )
}

function DataTableHeaderCell<TData extends RowData>({
  header,
  table,
  selectionBoundaryProps,
  stickyLeadingColumnIds,
  stickyLeadingOffsets,
  isLastStickyLeadingColumn,
}: HeaderCellProps<TData> & StickyLeadingCellProps) {
  const columnId = header.column.id
  const isSticky = stickyLeadingColumnIds.includes(columnId)

  return (
    <th
      className={getHeaderCellClassName(
        columnId,
        isSticky,
        isLastStickyLeadingColumn,
      )}
      style={{
        width: header.getSize(),
        ...(isSticky ? { left: stickyLeadingOffsets[columnId] } : undefined),
      }}
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
      <div
        className={cn(
          'min-w-0 flex-1',
          header.column.id === 'select' && 'flex justify-center',
        )}
      >
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
    return (
      <span className="inline-flex min-w-0 items-center gap-1.5">
        {children}
      </span>
    )
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

function getHeaderCellClassName(
  columnId: string,
  isSticky: boolean,
  isLastStickyLeadingColumn: boolean,
) {
  return cn(
    'py-3 align-middle font-medium text-muted-foreground whitespace-nowrap',
    // `sticky` y `relative` son mutuamente excluyentes en `position` — el
    // contexto de posicionamiento del resize handle vive en el div interno
    // de HeaderCellInner (que ya trae su propio `relative`), así que aquí no
    // hace falta combinarlos.
    // `bg-muted` (opaco), no `bg-muted/40`: la fila del thead usa /40 porque
    // se ve sobre el fondo estático del contenedor, pero estas celdas fijas
    // (`sticky`) van sobre encabezados que siguen desplazándose por debajo —
    // con alfa parcial ese texto se transparenta a través. Mismo criterio que
    // ya usa `bg-card` (opaco) en las celdas del body.
    isSticky ? 'sticky z-10 bg-muted' : 'relative',
    isSelectionColumn(columnId) && 'group/select-header',
    columnId === 'select' ? 'px-3 text-center' : 'px-4 text-left',
    isLastStickyLeadingColumn && STICKY_LEADING_BORDER_CLASS,
  )
}

// El id `'select'` es una convención propia de `DataTable` (no de la columna
// que el caller define): controla el centrado del checkbox y su afordancia de
// aparición al hover — comportamiento ORTOGONAL a qué columnas quedan fijas,
// que ahora configura el caller vía `stickyLeadingColumnIds`.
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
    Object.entries(currentSizing).filter(
      ([columnId, size]) =>
        availableIds.has(columnId) && Number.isFinite(size) && size > 0,
    ),
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

function clampColumnSize(nextSize: number, minSize?: number, maxSize?: number) {
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
      columnSizing:
        parsedValue.columnSizing != null &&
        typeof parsedValue.columnSizing === 'object'
          ? Object.fromEntries(
              Object.entries(parsedValue.columnSizing).filter(
                ([, size]) => typeof size === 'number' && Number.isFinite(size),
              ),
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
