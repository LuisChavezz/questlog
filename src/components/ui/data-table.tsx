/**
 * DataTable — componente de tabla reutilizable basado en TanStack Table.
 * Incluye: ordenamiento por columna, filtro global, paginación y estado de carga.
 */
import * as React from 'react'
import type { ColumnDef, ColumnFiltersState, SortingState, VisibilityState } from '@tanstack/react-table'
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { ChevronDown, ChevronUp, ChevronsUpDown } from 'lucide-react'

import { cn } from '#/lib/utils'
import { DataTablePagination } from '#/components/ui/data-table-pagination'
import { DataTableSkeleton } from '#/components/ui/data-table-skeleton'
import { DataTableToolbar } from '#/components/ui/data-table-toolbar'

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  /** Placeholder for the global search input */
  filterPlaceholder?: string
  /** Number of rows per page */
  defaultPageSize?: number
  /** Additional class names for the wrapper */
  className?: string
  /** Shows skeleton rows when true */
  isLoading?: boolean
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function DataTable<TData, TValue>({
  columns,
  data,
  filterPlaceholder = 'Filter...',
  defaultPageSize = 10,
  className,
  isLoading = false,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [globalFilter, setGlobalFilter] = React.useState('')
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({})

  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnFilters, globalFilter, columnVisibility },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: defaultPageSize } },
  })

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      <DataTableToolbar table={table} filterPlaceholder={filterPlaceholder} />

      <div className="rounded-xl border border-border overflow-hidden bg-card shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr
                  key={headerGroup.id}
                  className="border-b border-border bg-muted/40"
                >
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className="px-4 py-3 text-left font-medium text-muted-foreground whitespace-nowrap"
                      style={{ width: header.getSize() }}
                    >
                      {header.isPlaceholder ? null : (
                        <SortableHeader
                          canSort={header.column.getCanSort()}
                          isSorted={header.column.getIsSorted()}
                          onSort={header.column.getToggleSortingHandler()}
                        >
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                        </SortableHeader>
                      )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>

            <tbody>
              {isLoading ? (
                <DataTableSkeleton
                  columns={columns.length}
                  rows={defaultPageSize}
                />
              ) : table.getRowModel().rows.length ? (
                table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-border last:border-0 transition-colors hover:bg-muted/30"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-4 py-3 align-middle">
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={columns.length}
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

// ─── Encabezado con icono ─────────────────────────────────────────────────────

interface ColumnHeaderProps {
  /** Icono de Lucide que aparecerá a la izquierda del título. */
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
  children: React.ReactNode
}

/**
 * Envuelve el título de una columna con un icono semántico a la izquierda.
 * Exportado para ser reutilizado en todas las definiciones de columnas.
 */
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

// ─── Encabezado ordenable ─────────────────────────────────────────────────────

interface SortableHeaderProps {
  canSort: boolean
  isSorted: false | 'asc' | 'desc'
  onSort?: React.MouseEventHandler<HTMLButtonElement>
  children: React.ReactNode
}

function SortableHeader({
  canSort,
  isSorted,
  onSort,
  children,
}: SortableHeaderProps) {
  if (!canSort) return <span>{children}</span>

  return (
    <button
      onClick={onSort}
      className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors group"
    >
      {children}
      <span className="text-muted-foreground/50 group-hover:text-muted-foreground transition-colors">
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
