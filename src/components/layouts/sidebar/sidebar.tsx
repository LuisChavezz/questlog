import { ChevronLeft, ChevronRight } from 'lucide-react'

import { NAV_ITEMS } from '#/config/nav-items'
import { cn } from '#/lib/utils'

import { SidebarNavItem } from './sidebar-nav-item'
import { ThemeSwitch } from './theme-switch'

interface SidebarProps {
  isFixed: boolean
  isExpanded: boolean
  onToggle: () => void
  onMouseEnter: () => void
  onMouseLeave: () => void
}

export function Sidebar({
  isFixed,
  isExpanded,
  onToggle,
  onMouseEnter,
  onMouseLeave,
}: SidebarProps) {
  // Modo overlay: visualmente expandido pero sin empujar el contenido
  const isOverlay = isExpanded && !isFixed

  return (
    /*
     * Wrapper: reserva el espacio en el flow del layout.
     * Cuando es overlay (hover), el wrapper mantiene el ancho colapsado
     * y el panel se extiende absolutamente por encima del contenido.
     */
    <div
      className={cn(
        'relative shrink-0 h-full',
        'transition-[width] duration-300 ease-in-out',
        isFixed ? 'w-64' : 'w-16',
      )}
    >
      {/*
       * Panel outer: overflow-visible para que el botón de toggle
       * pueda sobresalir del borde derecho sin ser cortado.
       */}
      <div
        className={cn(
          'absolute inset-y-0 left-0',
          'overflow-visible',
          'transition-[width] duration-300 ease-in-out',
          isExpanded ? 'w-64' : 'w-16',
          isOverlay ? 'z-40' : 'z-10',
        )}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      >
        {/*
         * Panel inner: overflow-hidden para recortar labels y elementos
         * que no caben cuando el sidebar está colapsado.
         */}
        <div
          className={cn(
            'h-full flex flex-col',
            'bg-white dark:bg-neutral-900',
            'border-r border-neutral-100 dark:border-neutral-800',
            'overflow-hidden',
            isOverlay && 'shadow-2xl',
          )}
        >
          {/* Cabecera: marca + nombre de la app */}
          <div className="flex h-16 shrink-0 items-center px-4">
            <div
              className={cn(
                'flex h-8 w-8 shrink-0 items-center justify-center',
                'rounded-lg bg-primary text-primary-foreground',
                'text-[11px] font-bold tracking-tight select-none',
              )}
            >
              Q
            </div>

            {/* Nombre y subtítulo: se desvanecen al colapsar */}
            <div
              className={cn(
                'ml-3 overflow-hidden',
                'transition-[max-width,opacity] duration-300 ease-in-out',
                isExpanded ? 'max-w-40 opacity-100' : 'max-w-0 opacity-0',
              )}
            >
              <span className="block text-sm font-semibold text-foreground whitespace-nowrap">
                Questlog
              </span>
              <span className="block text-[11px] leading-tight text-muted-foreground whitespace-nowrap">
                Task Manager
              </span>
            </div>
          </div>

          {/* Separador */}
          <div className="mx-3 h-px shrink-0 bg-neutral-100 dark:bg-neutral-800" />

          {/* Navegación */}
          <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3 px-2">
            <ul className="space-y-0.5">
              {NAV_ITEMS.map((item) => (
                <SidebarNavItem key={item.to} item={item} isExpanded={isExpanded} />
              ))}
            </ul>
          </nav>

          {/* Separador inferior */}
          <div className="mx-3 h-px shrink-0 bg-neutral-100 dark:bg-neutral-800" />

          {/* Selector de tema premium con switch sol/luna */}
          <ThemeSwitch isExpanded={isExpanded} />
        </div>

        <button
          type="button"
          onClick={onToggle}
          aria-label={isFixed ? 'Contraer sidebar' : 'Expandir sidebar'}
          className={cn(
            'absolute top-5.5 right-0 translate-x-1/2 z-50',
            'flex h-6 w-6 items-center justify-center rounded-full',
            'bg-primary text-primary-foreground',
            'shadow-md ring-2 ring-white dark:ring-neutral-900',
            'hover:brightness-110 active:scale-90',
            'transition-transform duration-150',
            'cursor-pointer select-none',
          )}
        >
          {isFixed ? (
            <ChevronLeft size={12} strokeWidth={2.5} />
          ) : (
            <ChevronRight size={12} strokeWidth={2.5} />
          )}
        </button>
      </div>
    </div>
  )
}

