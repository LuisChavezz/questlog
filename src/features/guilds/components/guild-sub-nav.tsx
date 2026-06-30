import { useEffect, useState } from 'react'

import { Link, useRouterState } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import type { LucideIcon } from 'lucide-react'
import {
  ChevronDown,
  LayoutGrid,
  ScrollText,
  Settings2,
  Shield,
  Users,
} from 'lucide-react'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import { Tooltip } from '#/components/ui/tooltip'
import { guildQueryOptions } from '#/features/guilds/api/guild-query-options'
import { cn } from '#/lib/utils'

type GuildRole = 'owner' | 'admin' | 'member'

// Rutas tipadas de TanStack Router para las sub-páginas del guild
type GuildSubRoutePath =
  | '/guilds/$slug'
  | '/guilds/$slug/quests'
  | '/guilds/$slug/members'
  | '/guilds/$slug/settings'

type SubNavItem = {
  label: string
  // Ruta de TanStack Router (con $slug) — para navegación client-side vía Link
  to: GuildSubRoutePath
  // Params para resolver la ruta dinámica
  params: { slug: string }
  // href resuelto — únicamente para comparar con el pathname actual
  href: string
  icon: LucideIcon
  // Cuando es true, el match se hace exacto (para el índice del guild)
  exact?: boolean
}

function buildSubNavItems(slug: string, role: GuildRole): SubNavItem[] {
  const isOwner = role === 'owner'
  const p = { slug }
  return [
    {
      label: 'Overview',
      to: '/guilds/$slug',
      params: p,
      href: `/guilds/${slug}`,
      icon: LayoutGrid,
      exact: true,
    },
    {
      label: 'Quests',
      to: '/guilds/$slug/quests',
      params: p,
      href: `/guilds/${slug}/quests`,
      icon: ScrollText,
    },
    {
      label: 'Members',
      to: '/guilds/$slug/members',
      params: p,
      href: `/guilds/${slug}/members`,
      icon: Users,
    },
    ...(isOwner
      ? [
          {
            label: 'Settings',
            to: '/guilds/$slug/settings' as GuildSubRoutePath,
            params: p,
            href: `/guilds/${slug}/settings`,
            icon: Settings2,
          },
        ]
      : []),
  ]
}

// Determina si un sub-ítem está activo según su href resuelto y el pathname actual
function isSubItemActive(item: SubNavItem, pathname: string): boolean {
  return item.exact
    ? pathname === item.href || pathname === item.href.replace(/\/$/, '')
    : pathname.startsWith(item.href)
}

interface GuildNavItemProps {
  isExpanded: boolean
}

// "Guilds" como enlace directo al directorio + encabezado de sección del guild activo.
// En modo colapsado: ícono Guilds (directo) + ícono del guild con flyout de sub-ítems.
// En modo expandido: enlace Guilds + encabezado de sección con chevron + sub-ítems.
export function GuildNavItem({ isExpanded }: GuildNavItemProps) {
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  // Extrae el slug del guild de la URL: /guilds/<slug>[/...]
  const slugMatch = /^\/guilds\/([a-z0-9-]+)/.exec(pathname)
  const slug = slugMatch?.[1] ?? null

  // Estado de disclosure del encabezado de sección del guild activo
  const [isSubNavOpen, setIsSubNavOpen] = useState(() => !!slug)

  // Auto-expande el disclosure al navegar hacia una ruta de guild
  useEffect(() => {
    if (slug) setIsSubNavOpen(true)
  }, [slug])

  // Nombre del guild activo — la query ya está preloaded en caché por el loader de la ruta
  const { data: guildDetail } = useQuery({
    ...guildQueryOptions(slug ?? ''),
    enabled: !!slug,
  })
  const guildName = guildDetail?.guild.name ?? slug ?? ''

  const currentUserRole = guildDetail?.currentUserRole ?? 'member'
  const subItems = slug ? buildSubNavItems(slug, currentUserRole) : []

  // --- Modo colapsado ---
  if (!isExpanded) {
    return (
      <>
        {/* "Guilds" — siempre navega directamente al directorio */}
        <li>
          <Tooltip content="Guilds" side="right">
            <Link
              to="/guilds"
              activeOptions={{ exact: true }}
              className={cn(
                'flex w-full items-center justify-center rounded-lg py-2 px-0',
                'text-sm font-medium',
                'outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring',
                'transition-colors duration-150',
              )}
              activeProps={{ className: 'bg-primary/10 text-primary' }}
              inactiveProps={{
                className:
                  'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground',
              }}
            >
              <Shield size={18} className="shrink-0" aria-hidden="true" />
            </Link>
          </Tooltip>
        </li>

        {/* Ícono del guild activo — flyout con sub-ítems del guild */}
        {slug && (
          <li>
            <DropdownMenu>
              <Tooltip content={guildName} side="right">
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      'flex w-full items-center justify-center rounded-lg py-2 px-0',
                      'text-sm font-medium cursor-pointer',
                      'outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring',
                      'transition-colors duration-150',
                      'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground',
                    )}
                  >
                    {/* Badge con la inicial del guild — distingue visualmente de "Guilds" */}
                    <span
                      className={cn(
                        'flex h-[18px] w-[18px] items-center justify-center',
                        'rounded text-[10px] font-bold uppercase',
                        'bg-muted text-muted-foreground',
                      )}
                      aria-hidden="true"
                    >
                      {guildName[0]}
                    </span>
                  </button>
                </DropdownMenuTrigger>
              </Tooltip>
              <DropdownMenuContent side="right" align="start" sideOffset={8}>
                {subItems.map((item) => {
                  const Icon = item.icon
                  const isActive = isSubItemActive(item, pathname)
                  return (
                    <DropdownMenuItem
                      key={item.href}
                      asChild
                      className={isActive ? 'focus:bg-primary/10! focus:text-primary!' : undefined}
                    >
                      <Link
                        to={item.to}
                        params={item.params}
                        activeProps={{}}
                        inactiveProps={{}}
                        className={cn(
                          'flex items-center gap-2 cursor-pointer',
                          isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground',
                        )}
                      >
                        <Icon size={15} className="text-inherit" aria-hidden="true" />
                        {item.label}
                      </Link>
                    </DropdownMenuItem>
                  )
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          </li>
        )}
      </>
    )
  }

  // --- Modo expandido ---
  return (
    <>
      {/* "Guilds" — siempre enlace directo al directorio, sin chevron */}
      <li>
        <Link
          to="/guilds"
          activeOptions={{ exact: true }}
          className={cn(
            'flex w-full items-center gap-3 rounded-lg py-2 px-2.5',
            'text-sm font-medium',
            'outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring',
            'transition-colors duration-150',
          )}
          activeProps={{ className: 'bg-primary/10 text-primary' }}
          inactiveProps={{
            className:
              'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground',
          }}
        >
          <Shield size={18} className="shrink-0" aria-hidden="true" />
          <span className="overflow-hidden whitespace-nowrap">Guilds</span>
        </Link>
      </li>

      {/* Encabezado de sección del guild activo — solo alterna disclosure, no navega */}
      {slug && (
        <li>
          <button
            type="button"
            onClick={() => setIsSubNavOpen((prev) => !prev)}
            aria-label={isSubNavOpen ? 'Collapse guild navigation' : 'Expand guild navigation'}
            className={cn(
              'flex w-full items-center gap-2 rounded-lg py-1 px-2.5',
              'text-xs font-medium text-muted-foreground',
              'cursor-pointer select-none',
              'outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring',
              'hover:bg-sidebar-accent hover:text-sidebar-foreground',
              'transition-colors duration-150',
            )}
          >
            <span className="flex-1 overflow-hidden whitespace-nowrap text-left">
              {guildName}
            </span>
            <ChevronDown
              size={12}
              className={cn(
                'shrink-0 transition-transform duration-200',
                isSubNavOpen && 'rotate-180',
              )}
              aria-hidden="true"
            />
          </button>
        </li>
      )}

      {/* Sub-ítems del guild activo */}
      {slug &&
        isSubNavOpen &&
        subItems.map((item) => {
          const isActive = isSubItemActive(item, pathname)
          const Icon = item.icon
          return (
            <li key={item.href}>
              <Link
                to={item.to}
                params={item.params}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-lg py-1.5 pl-8 pr-2.5',
                  'text-xs font-medium',
                  'outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring',
                  'transition-colors duration-150',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground',
                )}
              >
                <Icon size={15} className="shrink-0" aria-hidden="true" />
                <span className="overflow-hidden whitespace-nowrap">{item.label}</span>
              </Link>
            </li>
          )
        })}
    </>
  )
}
