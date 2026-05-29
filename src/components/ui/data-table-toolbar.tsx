/**
 * DataTableToolbar — barra de herramientas compacta para DataTable.
 *
 * - Búsqueda: control compacto en el lado derecho que expande un input.
 * - Acciones: slot opcional a la derecha del buscador.
 * - Layout estable: el grupo de acciones queda anclado a la derecha para que
 *   la expansión ocurra hacia la izquierda sin mover la acción principal.
 */
import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import type { Table } from '@tanstack/react-table'
import { Search, X } from 'lucide-react'

import { Button } from '#/components/ui/button'
import { cn } from '#/lib/utils'
import { Input } from '#/components/ui/input'

interface DataTableToolbarProps<TData> {
  table: Table<TData>
  filterPlaceholder?: string
  /** Slot derecho: acciones como botones de creación, filtros, etc. */
  actions?: ReactNode
}

export function DataTableToolbar<TData>({
  table,
  filterPlaceholder = 'Filter...',
  actions,
}: DataTableToolbarProps<TData>) {
  const [searchOpen, setSearchOpen] = useState(
    () => Boolean(table.getState().globalFilter),
  )
  const inputRef = useRef<HTMLInputElement>(null)

  const globalFilter = (table.getState().globalFilter as string) || ''
  const hasActiveFilter = globalFilter.trim().length > 0
  const resultCount = table.getFilteredRowModel().rows.length

  // Auto-focus cuando se abre el buscador; pequeño delay para que la
  // transición CSS ya haya comenzado antes de intentar el foco.
  useEffect(() => {
    if (!searchOpen) return
    const id = setTimeout(() => inputRef.current?.focus(), 60)
    return () => clearTimeout(id)
  }, [searchOpen])

  // Si el filtro global cambia desde fuera, mantener visible el buscador.
  useEffect(() => {
    if (hasActiveFilter) {
      setSearchOpen(true)
    }
  }, [hasActiveFilter])

  const handleToggle = () => {
    if (searchOpen) {
      table.setGlobalFilter('')
    }
    setSearchOpen((v) => !v)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      table.setGlobalFilter('')
      setSearchOpen(false)
    }
  }

  return (
    <div className="flex min-h-9 items-center gap-3">
      <div className="flex min-w-0 flex-1 items-center">
        <span
          className={cn(
            'truncate text-xs text-muted-foreground transition-opacity duration-150',
            hasActiveFilter ? 'opacity-100' : 'pointer-events-none opacity-0',
          )}
          aria-live="polite"
          aria-atomic="true"
        >
          {resultCount} {resultCount === 1 ? 'result' : 'results'}
        </span>
      </div>

      <div className="ml-auto flex items-center gap-2">
        {/* Búsqueda compacta en el lado derecho, antes de las acciones. */}
        <div
          className={cn(
            'flex h-8 items-center overflow-hidden rounded-lg border backdrop-blur-[2px]',
            'transition-[width,background-color,border-color,box-shadow] duration-200 ease-out',
            'focus-within:border-ring/70 focus-within:bg-background/95 focus-within:shadow-xs',
            searchOpen
              ? 'w-44 border-border/70 bg-background/85 shadow-xs dark:bg-card/80 sm:w-56'
              : 'w-8 border-border/60 bg-background/65 shadow-xs hover:border-border hover:bg-muted/45 dark:bg-card/55',
          )}
        >
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={handleToggle}
            aria-label={searchOpen ? 'Close search' : 'Open search'}
            aria-expanded={searchOpen}
            className={cn(
              'size-8 rounded-[0.55rem] border border-transparent bg-transparent text-muted-foreground shadow-none',
              'hover:bg-transparent hover:text-foreground focus-visible:ring-2',
              searchOpen && 'text-foreground',
            )}
          >
            {searchOpen ? (
              <X className="size-3.5" aria-hidden="true" />
            ) : (
              <Search className="size-3.5" aria-hidden="true" />
            )}
          </Button>

          <div
            className={cn(
              'min-w-0 flex-1 overflow-hidden transition-[opacity,transform] duration-150 ease-out',
              searchOpen
                ? 'opacity-100 translate-x-0'
                : 'pointer-events-none opacity-0 translate-x-1',
            )}
            aria-hidden={!searchOpen}
          >
            <Input
              ref={inputRef}
              placeholder={filterPlaceholder}
              value={globalFilter}
              onChange={(e) => table.setGlobalFilter(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={!searchOpen}
              aria-hidden={!searchOpen}
              tabIndex={searchOpen ? 0 : -1}
              className={cn(
                'h-8 border-0 bg-transparent px-2.5 pr-3 text-sm shadow-none',
                'placeholder:text-muted-foreground/70 focus-visible:border-0 focus-visible:ring-0',
                'dark:bg-transparent',
              )}
            />
          </div>
        </div>

        {actions && (
          <div className="flex items-center gap-2">
          {actions}
          </div>
        )}
      </div>
    </div>
  )
}
