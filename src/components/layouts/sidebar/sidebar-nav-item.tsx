import { Link } from '@tanstack/react-router'

import type { NavItem } from '#/config/nav-items'
import { cn } from '#/lib/utils'

interface SidebarNavItemProps {
  item: NavItem
  isExpanded: boolean
}

// Componente de ítem individual de navegación del sidebar.
// Aplica estilos de activo/inactivo via TanStack Router y controla
// la visibilidad de la etiqueta según el estado de expansión del sidebar.
export function SidebarNavItem({ item, isExpanded }: SidebarNavItemProps) {
  const { label, to, icon: Icon } = item

  return (
    <li>
      <Link
        to={to}
        className={cn(
          'flex w-full items-center gap-3 rounded-lg px-3 py-2.5',
          'text-sm font-medium',
          'outline-none focus-visible:ring-2 focus-visible:ring-ring',
          'transition-colors duration-150',
        )}
        activeProps={{
          className: 'bg-primary/[0.08] text-primary dark:bg-primary/20',
        }}
        inactiveProps={{
          className: cn(
            'text-neutral-500 dark:text-neutral-400',
            'hover:bg-neutral-50 hover:text-neutral-900',
            'dark:hover:bg-neutral-800 dark:hover:text-neutral-100',
          ),
        }}
      >
        <Icon size={18} className="shrink-0" aria-hidden="true" />

        {/* Etiqueta: se desvanece al colapsar con transición suave */}
        <span
          className={cn(
            'overflow-hidden whitespace-nowrap',
            'transition-[max-width,opacity] duration-200 ease-in-out',
            isExpanded ? 'max-w-40 opacity-100' : 'max-w-0 opacity-0',
          )}
        >
          {label}
        </span>
      </Link>
    </li>
  )
}
