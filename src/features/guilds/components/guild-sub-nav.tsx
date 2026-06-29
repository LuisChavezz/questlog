import { useRouterState } from '@tanstack/react-router'
import type { LucideIcon } from 'lucide-react'
import { LayoutGrid, ScrollText, Settings2, Users } from 'lucide-react'

import { Tooltip } from '#/components/ui/tooltip'
import { cn } from '#/lib/utils'

type GuildRole = 'owner' | 'admin' | 'member'

// Mock: role del usuario en el guild — se reemplazará con datos reales del contexto
const MOCK_ROLE: GuildRole = 'owner'

type SubNavItem = {
  label: string
  href: string
  icon: LucideIcon
  // Cuando es true, el match se hace exacto (para el índice del guild)
  exact?: boolean
}

function buildSubNavItems(slug: string, role: GuildRole): SubNavItem[] {
  const isAdmin = role === 'owner' || role === 'admin'
  return [
    { label: 'Overview', href: `/guilds/${slug}/`, icon: LayoutGrid, exact: true },
    { label: 'Quests', href: `/guilds/${slug}/quests`, icon: ScrollText },
    { label: 'Members', href: `/guilds/${slug}/members`, icon: Users },
    ...(isAdmin
      ? [{ label: 'Settings', href: `/guilds/${slug}/settings`, icon: Settings2 }]
      : []),
  ]
}

interface GuildSubNavProps {
  isExpanded: boolean
}

// Sub-navegación del sidebar: aparece bajo el ítem "Guilds" cuando el usuario
// está dentro de un guild. Detecta el slug activo vía pathname.
export function GuildSubNav({ isExpanded }: GuildSubNavProps) {
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  // Extrae el slug del guild de la URL: /guilds/<slug>[/...]
  const slugMatch = /^\/guilds\/([a-z0-9-]+)/.exec(pathname)
  const slug = slugMatch?.[1] ?? null

  if (!slug) return null

  const items = buildSubNavItems(slug, MOCK_ROLE)

  return (
    <>
      {items.map((item) => {
        const isActive = item.exact
          ? pathname === item.href || pathname === item.href.replace(/\/$/, '')
          : pathname.startsWith(item.href)
        const Icon = item.icon

        const link = (
          <a
            href={item.href}
            className={cn(
              'flex w-full items-center rounded-lg py-1.5',
              'text-xs font-medium',
              'outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring',
              'transition-colors duration-150',
              isExpanded ? 'gap-2.5 pl-8 pr-2.5' : 'justify-center px-0',
              isActive
                ? 'bg-primary/10 text-primary dark:bg-primary/15'
                : cn(
                    'text-sidebar-foreground/65',
                    'hover:bg-sidebar-accent hover:text-sidebar-foreground',
                  ),
            )}
          >
            <Icon size={15} className="shrink-0" aria-hidden="true" />
            <span
              className={cn(
                'overflow-hidden whitespace-nowrap',
                'transition-[max-width,opacity] duration-200 ease-in-out',
                isExpanded ? 'max-w-40 opacity-100' : 'max-w-0 opacity-0',
              )}
            >
              {item.label}
            </span>
          </a>
        )

        return (
          <li key={item.href}>
            {isExpanded ? (
              link
            ) : (
              <Tooltip content={item.label} side="right">
                {link}
              </Tooltip>
            )}
          </li>
        )
      })}
    </>
  )
}
