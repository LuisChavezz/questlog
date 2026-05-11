/**
 * DataTableToolbar — barra de búsqueda y contador de resultados para DataTable.
 */
import type { Table } from '@tanstack/react-table'
import { Search } from 'lucide-react'

import { Input } from '#/components/ui/input'

interface DataTableToolbarProps<TData> {
  table: Table<TData>
  filterPlaceholder?: string
}

export function DataTableToolbar<TData>({
  table,
  filterPlaceholder = 'Filter...',
}: DataTableToolbarProps<TData>) {
  const resultCount = table.getFilteredRowModel().rows.length

  return (
    <div className="flex items-center gap-2">
      <div className="relative flex-1 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
        <Input
          placeholder={filterPlaceholder}
          value={(table.getState().globalFilter as string) || ''}
          onChange={(e) => table.setGlobalFilter(e.target.value)}
          className="pl-9"
        />
      </div>
      <span className="ml-auto text-xs text-muted-foreground">
        {resultCount} {resultCount === 1 ? 'result' : 'results'}
      </span>
    </div>
  )
}
