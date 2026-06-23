import { Link } from '@tanstack/react-router'

import type { NavItem } from '#/config/nav-items'
import { Tooltip } from '#/components/ui/tooltip'
import { cn } from '#/lib/utils'

interface SidebarNavItemProps {
  item: NavItem
  isExpanded: boolean
}

// Ítem de navegación del sidebar.
// En modo colapsado muestra solo el ícono con un tooltip al pasar el cursor.
export function SidebarNavItem({ item, isExpanded }: SidebarNavItemProps) {
  const { label, to, icon: Icon } = item

  const link = (
    <Link
      to={to}
      className={cn(
        'flex w-full items-center rounded-lg py-2',
        'text-sm font-medium',
        'outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring',
        'transition-colors duration-150',
        isExpanded ? 'gap-3 px-2.5' : 'justify-center px-0',
      )}
      activeProps={{
        className: 'bg-primary/10 text-primary dark:bg-primary/15',
      }}
      inactiveProps={{
        className: cn(
          'text-sidebar-foreground/65',
          'hover:bg-sidebar-accent hover:text-sidebar-foreground',
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
  )

  return (
    <li>
      {isExpanded ? (
        link
      ) : (
        <Tooltip content={label} side="right">
          {link}
        </Tooltip>
      )}
    </li>
  )
}
