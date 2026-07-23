import { ScrollText, Shield } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

// Tipo que representa un ítem de navegación del sidebar
export interface NavItem {
  label: string
  to: '/quests' | '/guilds'
  icon: LucideIcon
}

// Configuración centralizada de los ítems de navegación principal
export const NAV_ITEMS: NavItem[] = [
  {
    label: 'Quests',
    to: '/quests',
    icon: ScrollText,
  },
  {
    label: 'Guilds',
    to: '/guilds',
    icon: Shield,
  },
]
