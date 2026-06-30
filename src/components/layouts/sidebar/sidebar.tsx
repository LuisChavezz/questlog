import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'

import { NAV_ITEMS } from '#/config/nav-items'
import { Tooltip, TooltipProvider } from '#/components/ui/tooltip'
import { GuildNavItem } from '#/features/guilds/components/guild-sub-nav'
import { cn } from '#/lib/utils'

import { SidebarNavItem } from './sidebar-nav-item'
import { ThemeSwitch } from './theme-switch'

interface SidebarProps {
  isExpanded: boolean
  onToggle: () => void
}

export function Sidebar({ isExpanded, onToggle }: SidebarProps) {
  return (
    <TooltipProvider>
      {/*
       * Wrapper: reserva espacio fijo en el layout.
       * El ancho cambia únicamente al hacer clic en el botón de toggle.
       */}
      <div
        className={cn(
          'relative shrink-0 h-full',
          'transition-[width] duration-300 ease-in-out',
          isExpanded ? 'w-64' : 'w-16',
        )}
      >
        <div
          className={cn(
            'absolute inset-y-0 left-0 z-10',
            'transition-[width] duration-300 ease-in-out',
            isExpanded ? 'w-64' : 'w-16',
          )}
        >
          {/* Panel inner: overflow-hidden recorta labels al colapsar */}
          <div
            className={cn(
              'h-full flex flex-col',
              'bg-sidebar',
              'border-r border-sidebar-border',
              'overflow-hidden',
            )}
          >
            {/* Cabecera */}
            <div className="flex h-14 shrink-0 items-center gap-2 px-3">
              {isExpanded ? (
                // Expandido: logo + título + botón de colapso
                <>
                  <div className="flex min-w-0 flex-1 items-center gap-2.5">
                    <div
                      className={cn(
                        'flex h-8 w-8 shrink-0 items-center justify-center',
                        'rounded-lg bg-primary text-primary-foreground',
                        'text-[11px] font-bold tracking-tight select-none',
                      )}
                    >
                      Q
                    </div>
                    <span className="overflow-hidden whitespace-nowrap text-sm font-semibold text-sidebar-foreground">
                      Questlog
                    </span>
                  </div>

                  <Tooltip content="Collapse" side="right">
                    <button
                      type="button"
                      onClick={onToggle}
                      aria-label="Collapse sidebar"
                      className={cn(
                        'flex size-8 shrink-0 items-center justify-center rounded-lg',
                        'text-muted-foreground',
                        'hover:bg-sidebar-accent hover:text-sidebar-foreground',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring',
                        'cursor-pointer select-none transition-colors duration-200',
                      )}
                    >
                      <PanelLeftClose size={18} aria-hidden="true" />
                    </button>
                  </Tooltip>
                </>
              ) : (
                // Colapsado: solo el botón de expandir, centrado
                <div className="flex flex-1 justify-center">
                  <Tooltip content="Expand" side="right">
                    <button
                      type="button"
                      onClick={onToggle}
                      aria-label="Expand sidebar"
                      className={cn(
                        'flex size-8 shrink-0 items-center justify-center rounded-lg',
                        'text-muted-foreground',
                        'hover:bg-sidebar-accent hover:text-sidebar-foreground',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring',
                        'cursor-pointer select-none transition-colors duration-200',
                      )}
                    >
                      <PanelLeftOpen size={18} aria-hidden="true" />
                    </button>
                  </Tooltip>
                </div>
              )}
            </div>

            {/* Separador */}
            <div className="mx-3 h-px shrink-0 bg-sidebar-border" />

            {/* Navegación */}
            <nav className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-3">
              <ul className="space-y-1">
                {NAV_ITEMS.map((item) =>
                  item.to === '/guilds' ? (
                    <GuildNavItem key={item.to} isExpanded={isExpanded} />
                  ) : (
                    <SidebarNavItem key={item.to} item={item} isExpanded={isExpanded} />
                  ),
                )}
              </ul>
            </nav>

            {/* Pie: separador + selector de tema */}
            <div className="mx-3 h-px shrink-0 bg-sidebar-border" />

            <ThemeSwitch isExpanded={isExpanded} />
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}
