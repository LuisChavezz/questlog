import { LayoutDashboard, ScrollText } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

// Tipo que representa un ítem de navegación del sidebar
export interface NavItem {
  label: string
  to: '/dashboard' | '/quests'
  icon: LucideIcon
}

// Configuración centralizada de los ítems de navegación principal
export const NAV_ITEMS: NavItem[] = [
  {
    label: 'Dashboard',
    to: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    label: 'Quests',
    to: '/quests',
    icon: ScrollText,
  },
]
