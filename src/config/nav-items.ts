import { CheckSquare, LayoutDashboard } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

// Tipo que representa un ítem de navegación del sidebar
export interface NavItem {
  label: string
  to: '/dashboard' | '/tasks'
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
    label: 'Tareas',
    to: '/tasks',
    icon: CheckSquare,
  },
]
