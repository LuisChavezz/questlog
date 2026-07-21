/**
 * DataTableFilterBar — barra de filtros compacta (estilo Notion/ERP) para usar
 * dentro del `filterPanel` de `DataTable`. Cada filtro activo se resume en un
 * chip ("Status: Backlog, To Do") con una "×" para limpiarlo; los filtros aún
 * sin chip aparecen listados en el menú "Add filter". Opera sobre
 * `columnFilters` de TanStack Table — cada `DataTableFilterDef` mapea a una
 * columna cuyo `filterFn` espera `string[]` (varios valores = OR entre ellos).
 *
 * "Add filter" y el chip activo comparten un único flujo de edición: elegir
 * una columna en "Add filter" solo crea su chip (con `[]`, sin valores) y
 * abre automáticamente el mismo desplegable de checkboxes que el chip ya
 * activo usa para reabrirse — no hay un segundo camino que además intente
 * capturar el primer valor en el mismo click.
 */
import { Fragment, useEffect, useMemo, useState } from 'react'
import type { Table } from '@tanstack/react-table'
import { Plus, X } from 'lucide-react'

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import { cn } from '#/lib/utils'

export interface DataTableFilterOption {
  value: string
  label: string
  icon?: React.ElementType
  // Antepone un separador visual a esta opción — p. ej. para distinguir un
  // grupo especial (como "Unassigned") del resto de opciones que le siguen.
  separatorBefore?: boolean
}

export interface DataTableFilterDef {
  /** Id estable del filtro (independiente de `columnId` por si se reutiliza) */
  id: string
  columnId: string
  label: string
  options: readonly DataTableFilterOption[]
}

interface DataTableFilterBarProps<TData> {
  table: Table<TData>
  filters: readonly DataTableFilterDef[]
  /**
   * Si la fila de filtros del toolbar está expandida. Al pasar a `false`
   * (el usuario colapsa la fila con el toggle), cualquier dropdown propio
   * que siga abierto (de un chip o de "Add filter") se cierra con ella —
   * si no, un `DropdownMenuContent` portalado de Radix puede quedar visible,
   * flotando, desconectado de su trigger ya colapsado.
   */
  filterPanelOpen: boolean
}

// Un filtro cuenta como "activo" (tiene chip) en cuanto existe una entrada en
// `columnFilters` para su columna — sin importar si esa entrada es `[]` (chip
// recién creado, sin valores aún) o trae valores. `undefined` es la única
// forma de "sin chip"; así se distingue de "chip vacío" (requiere su propio
// `removeFilter`, no basta con vaciar la selección).
function isFilterActive<TData>(table: Table<TData>, columnId: string): boolean {
  return table.getColumn(columnId)?.getFilterValue() !== undefined
}

function getSelectedValues<TData>(
  table: Table<TData>,
  columnId: string,
): string[] {
  return (
    (table.getColumn(columnId)?.getFilterValue() as string[] | undefined) ?? []
  )
}

// Actualiza los valores seleccionados de un chip YA activo. A diferencia de
// antes, vaciar la selección no retira la entrada de `columnFilters` — el
// chip vacío se queda visible (equivale a "sin filtro" para esa columna) y
// solo desaparece si el usuario lo retira explícitamente con "×".
function setSelectedValues<TData>(
  table: Table<TData>,
  columnId: string,
  values: string[],
) {
  table.getColumn(columnId)?.setFilterValue(values)
}

function addFilter<TData>(table: Table<TData>, columnId: string) {
  table.getColumn(columnId)?.setFilterValue([])
}

function removeFilter<TData>(table: Table<TData>, columnId: string) {
  table.getColumn(columnId)?.setFilterValue(undefined)
}

export function DataTableFilterBar<TData>({
  table,
  filters,
  filterPanelOpen,
}: DataTableFilterBarProps<TData>) {
  // Id del filtro recién creado desde "Add filter" cuyo chip debe abrirse
  // solo una vez, en su montaje (ver `ActiveFilterChip`, que lo consume vía
  // el valor inicial de su propio `useState`). No hace falta limpiarlo
  // después: un chip solo puede montarse con `autoOpen=true` en el mismo
  // set de estado que lo creó (`onAddFilter` abajo), así que un valor viejo
  // aquí nunca coincide con el id de un chip que se monte más tarde.
  const [pendingOpenId, setPendingOpenId] = useState<string | null>(null)

  const columnFilters = table.getState().columnFilters

  // `DataTable` (el padre) re-renderiza esta barra ante CUALQUIER cambio de
  // su estado — una tecla en la búsqueda de texto, un resize de columna, un
  // click de orden — nada de lo cual afecta a `activeFilters`/
  // `availableFilters`. TanStack Table solo genera una referencia nueva de
  // `columnFilters` cuando un filtro realmente cambia, así que memoizar
  // contra esa referencia (y `filters`) evita reconstruir el `Map`/arrays en
  // cada uno de esos renders ajenos — mismo criterio que `stickyLeadingOffsets`
  // y `bulkActionContext` en `data-table.tsx`.
  const { activeFilters, availableFilters } = useMemo(() => {
    const filterByColumnId = new Map(filters.map((f) => [f.columnId, f]))

    return {
      // Orden de los chips activos: el de `columnFilters` (orden real de
      // creación — TanStack Table añade cada entrada nueva al final y
      // actualiza en el mismo lugar las ya existentes, nunca reordena), NO
      // el orden fijo de `QUEST_FILTERS`. Ese orden fijo sigue gobernando
      // "Add filter" más abajo, donde sí interesa un listado estable que
      // combine con las columnas.
      activeFilters: columnFilters
        .map((columnFilter) => filterByColumnId.get(columnFilter.id))
        .filter((filter): filter is DataTableFilterDef => filter !== undefined),
      availableFilters: filters.filter(
        (filter) => !isFilterActive(table, filter.columnId),
      ),
    }
  }, [filters, columnFilters, table])

  if (filters.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-2">
      {activeFilters.map((filter) => (
        <ActiveFilterChip
          key={filter.id}
          table={table}
          filter={filter}
          autoOpen={pendingOpenId === filter.id}
          filterPanelOpen={filterPanelOpen}
        />
      ))}

      <AddFilterMenu
        filters={availableFilters}
        onAddFilter={(filter) => {
          addFilter(table, filter.columnId)
          setPendingOpenId(filter.id)
        }}
        filterPanelOpen={filterPanelOpen}
      />
    </div>
  )
}

function ActiveFilterChip<TData>({
  table,
  filter,
  autoOpen,
  filterPanelOpen,
}: {
  table: Table<TData>
  filter: DataTableFilterDef
  autoOpen: boolean
  filterPanelOpen: boolean
}) {
  // Estado controlado (en vez de dejar el `DropdownMenu` sin controlar) para
  // poder abrirlo automáticamente apenas se crea el chip desde "Add filter".
  // `autoOpen` solo importa como valor INICIAL: React ignora los cambios
  // posteriores al argumento de `useState`, y este chip solo puede montarse
  // con `autoOpen=true` en el instante en que se crea (ver `pendingOpenId` en
  // `DataTableFilterBar`) — no hace falta un efecto que reaccione a cambios.
  const [open, setOpen] = useState(autoOpen)

  // Si el usuario colapsa la fila de filtros mientras este dropdown sigue
  // abierto, ciérralo con ella — si no, el `DropdownMenuContent` portalado de
  // Radix queda visible, flotando, desconectado de su trigger ya colapsado.
  useEffect(() => {
    if (!filterPanelOpen) setOpen(false)
  }, [filterPanelOpen])

  const selected = getSelectedValues(table, filter.columnId)
  const isEmpty = selected.length === 0
  const labelByValue = new Map(filter.options.map((o) => [o.value, o.label]))
  const summary = selected.map((v) => labelByValue.get(v) ?? v).join(', ')

  return (
    <div className="inline-flex items-stretch overflow-hidden rounded-md border border-border/70 bg-background/60 text-xs shadow-xs">
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={`Edit ${filter.label} filter`}
            className="inline-flex min-w-0 items-center gap-1 px-2 py-1 font-medium text-foreground transition-colors hover:bg-muted/60"
          >
            <span
              className={cn(
                'shrink-0',
                isEmpty ? 'text-foreground' : 'text-muted-foreground',
              )}
            >
              {filter.label}
              {!isEmpty && ':'}
            </span>
            {!isEmpty && <span className="max-w-40 truncate">{summary}</span>}
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start" className="w-48">
          <FilterValueOptions table={table} filter={filter} />
        </DropdownMenuContent>
      </DropdownMenu>

      <button
        type="button"
        aria-label={`Clear ${filter.label} filter`}
        onClick={() => removeFilter(table, filter.columnId)}
        className="inline-flex shrink-0 items-center border-l border-border/70 px-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
      >
        <X className="size-3" aria-hidden="true" />
      </button>
    </div>
  )
}

function AddFilterMenu({
  filters,
  onAddFilter,
  filterPanelOpen,
}: {
  filters: readonly DataTableFilterDef[]
  onAddFilter: (filter: DataTableFilterDef) => void
  filterPanelOpen: boolean
}) {
  // Mismo motivo que en `ActiveFilterChip`: si el usuario colapsa la fila de
  // filtros con este dropdown abierto, ciérralo con ella.
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!filterPanelOpen) setOpen(false)
  }, [filterPanelOpen])

  if (filters.length === 0) return null

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            'inline-flex shrink-0 items-center gap-1 rounded-md border border-dashed border-border/70 px-2 py-1 text-xs font-medium text-muted-foreground transition-colors',
            'hover:border-border hover:text-foreground',
          )}
        >
          <Plus className="size-3.5" aria-hidden="true" />
          Add filter
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-44">
        {filters.map((filter) => (
          <DropdownMenuItem
            key={filter.id}
            onSelect={() => onAddFilter(filter)}
          >
            {filter.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// Lista de checkboxes de valores de un filtro ya activo — único consumidor
// tanto si el chip lo creó "Add filter" hace un instante como si ya existía:
// no hace falta distinguir el origen, siempre se está editando un chip real.
// El menú se mantiene abierto entre selecciones para permitir multi-select;
// cierra por click afuera, Escape, o al volver a tocar el chip.
function FilterValueOptions<TData>({
  table,
  filter,
}: {
  table: Table<TData>
  filter: DataTableFilterDef
}) {
  const selected = getSelectedValues(table, filter.columnId)

  return (
    <>
      {filter.options.map((option) => {
        const isChecked = selected.includes(option.value)
        const Icon = option.icon
        return (
          <Fragment key={option.value}>
            {option.separatorBefore && <DropdownMenuSeparator />}
            <DropdownMenuCheckboxItem
              checked={isChecked}
              onCheckedChange={(checked) => {
                const next = checked
                  ? [...selected, option.value]
                  : selected.filter((v) => v !== option.value)
                setSelectedValues(table, filter.columnId, next)
              }}
              onSelect={(event) => event.preventDefault()}
            >
              {Icon && (
                <Icon
                  className="size-3.5 text-muted-foreground"
                  aria-hidden="true"
                />
              )}
              {option.label}
            </DropdownMenuCheckboxItem>
          </Fragment>
        )
      })}
    </>
  )
}
