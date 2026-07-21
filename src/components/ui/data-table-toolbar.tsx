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
import { Search, SlidersHorizontal, X } from 'lucide-react'

import { Button } from '#/components/ui/button'
import { cn } from '#/lib/utils'
import { Input } from '#/components/ui/input'

interface DataTableToolbarProps<TData> {
  table: Table<TData>
  filterPlaceholder?: string
  leadingContent?: ReactNode
  /** Slot derecho: acciones como botones de creación, filtros, etc. */
  actions?: ReactNode
  /**
   * Barra de filtros (chips + "Add filter"), ya resuelta contra `table` por
   * el caller (`DataTable` pasa `table` a su prop `filterPanel`). Se muestra
   * debajo de la fila de controles, colapsable vía el botón de sliders — el
   * toggle solo oculta/muestra la fila, nunca limpia los filtros activos.
   */
  filterPanel?: ReactNode
  /**
   * Estado controlado por `DataTable` (no local): también decide el `gap`
   * entre el toolbar y la tabla, así que ambos deben leer el mismo valor.
   */
  filterPanelOpen: boolean
  onFilterPanelOpenChange: (open: boolean) => void
}

export function DataTableToolbar<TData>({
  table,
  filterPlaceholder = 'Filter...',
  leadingContent,
  actions,
  filterPanel,
  filterPanelOpen,
  onFilterPanelOpenChange,
}: DataTableToolbarProps<TData>) {
  const [searchOpen, setSearchOpen] = useState(() =>
    Boolean(table.getState().globalFilter),
  )
  const inputRef = useRef<HTMLInputElement>(null)

  const globalFilter = (table.getState().globalFilter as string) || ''
  const hasActiveFilter = globalFilter.trim().length > 0
  // Un chip recién creado desde "Add filter" cuenta como entrada en
  // `columnFilters` (`[]`, sin valores) aunque no filtre nada todavía — el
  // punto solo debe señalar filtros que de verdad estén acotando filas.
  const hasActiveColumnFilters = table
    .getState()
    .columnFilters.some((columnFilter) =>
      Array.isArray(columnFilter.value)
        ? columnFilter.value.length > 0
        : Boolean(columnFilter.value),
    )
  // El conteo debe reaccionar a CUALQUIER filtro activo, no solo al de texto —
  // antes solo se mostraba con búsqueda de texto, dejando el conteo invisible
  // aunque un chip de columna (Status, Priority, ...) ya hubiera acotado filas.
  const hasAnyActiveFilter = hasActiveFilter || hasActiveColumnFilters
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
    <div className="flex flex-col">
      <div className="flex min-h-9 items-center gap-3">
        <div className="relative flex min-h-8 min-w-0 flex-1 items-center">
          <div
            className={cn(
              'flex min-w-0 flex-1 items-center transition-opacity duration-150 ease-out',
              leadingContent
                ? 'pointer-events-none absolute inset-0 opacity-0'
                : 'opacity-100',
            )}
          >
            <span
              className={cn(
                'truncate text-xs text-muted-foreground transition-opacity duration-150',
                hasAnyActiveFilter
                  ? 'opacity-100'
                  : 'pointer-events-none opacity-0',
              )}
              aria-live="polite"
              aria-atomic="true"
            >
              {resultCount} {resultCount === 1 ? 'result' : 'results'}
            </span>
          </div>

          <div
            className={cn(
              'flex min-w-0 flex-1 items-center transition-opacity duration-150 ease-out',
              leadingContent
                ? 'opacity-100'
                : 'pointer-events-none absolute inset-0 opacity-0',
            )}
          >
            {leadingContent}
          </div>
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

          {filterPanel && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => onFilterPanelOpenChange(!filterPanelOpen)}
              aria-label={filterPanelOpen ? 'Hide filters' : 'Show filters'}
              aria-expanded={filterPanelOpen}
              className={cn(
                'relative size-8 shrink-0 rounded-lg border border-border/60 bg-background/65 text-muted-foreground shadow-xs',
                'hover:border-border hover:bg-muted/45 hover:text-foreground',
                filterPanelOpen &&
                  'border-border/70 bg-background/85 text-foreground dark:bg-card/80',
              )}
            >
              <SlidersHorizontal className="size-3.5" aria-hidden="true" />
              {hasActiveColumnFilters && (
                <span
                  className="absolute top-1 right-1 size-1.5 rounded-full bg-primary"
                  aria-hidden="true"
                />
              )}
            </Button>
          )}

          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      </div>

      {filterPanel && (
        <div
          className={cn(
            'grid transition-[grid-template-rows] duration-200 ease-out',
            filterPanelOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
          )}
          // `aria-hidden` (mismo criterio que el buscador de arriba, vía
          // `aria-hidden={!searchOpen}`) más `inert`: a diferencia del input de
          // búsqueda (un único elemento que este componente controla), el
          // contenido de `filterPanel` es un árbol opaco de botones/dropdowns
          // que aporta el caller — no hay un `tabIndex` individual que fijar
          // aquí. `inert` saca TODO el subárbol del orden de tabulación (y del
          // árbol de accesibilidad) de una sola vez mientras está colapsado.
          aria-hidden={!filterPanelOpen}
          inert={!filterPanelOpen}
        >
          {/* `pt-3` (no `gap-3` en el contenedor de arriba) para que el espacio
              colapse junto con el contenido cuando `grid-rows-[0fr]` lo lleva a
              0 — un `gap` entre hermanos flex se mantiene aunque este bloque
              esté visualmente colapsado, dejando un hueco fantasma debajo de
              la fila de controles incluso con el panel cerrado. */}
          <div className="overflow-hidden pt-3">{filterPanel}</div>
        </div>
      )}
    </div>
  )
}
