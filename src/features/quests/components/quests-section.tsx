/**
 * QuestsSection — envoltorio plegable de una tabla de quests en `/quests`.
 *
 * La agrupación por origen vive AQUÍ, alrededor de tablas independientes, y no
 * dentro de `DataTable`: cada sección es su propia instancia con su toolbar,
 * sus filtros y su paginación, porque Assignee/Supervisor son conceptos con
 * alcance de guild y sus rosters no se pueden mezclar en un solo desplegable.
 */
import { useState } from 'react'
import type { ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'

import { cn } from '#/lib/utils'

interface QuestsSectionProps {
  label: ReactNode
  /** Total de quests de la sección — visible también estando plegada */
  count: number
  children: ReactNode
}

export function QuestsSection({ label, count, children }: QuestsSectionProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setIsCollapsed((collapsed) => !collapsed)}
          aria-expanded={!isCollapsed}
          className="inline-flex items-center gap-1.5 rounded-md text-sm font-medium text-foreground outline-none transition-colors hover:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <ChevronRight
            className={cn(
              'size-4 shrink-0 text-muted-foreground transition-transform duration-150 ease-out motion-reduce:transition-none',
              !isCollapsed && 'rotate-90',
            )}
            aria-hidden="true"
          />
          {label}
        </button>

        <span className="text-xs text-muted-foreground tabular-nums">
          {count}
        </span>
      </div>

      {/* `hidden` (que oculta el subárbol y lo saca del árbol de accesibilidad)
          en vez de desmontar: cada sección es una tabla con su propio estado de
          filtros, orden y paginación, y desmontarla al plegar lo perdería —
          reabrirla devolvería la vista por defecto en vez de como se dejó.

          Trade-off asumido: TODAS las secciones montan (y computan) su tabla en
          el primer render, plegadas o no. Con el puñado de guilds típico por
          usuario el costo es marginal, y la alternativa (arrancar plegadas +
          montar al primer despliegue) cambiaría el producto — quests de guild
          ocultas hasta hacer clic. Si algún día hay usuarios con decenas de
          guilds, ese lazy-mount es la palanca a considerar. */}
      <div hidden={isCollapsed}>{children}</div>
    </section>
  )
}
