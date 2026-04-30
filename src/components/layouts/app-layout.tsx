import { Outlet } from '@tanstack/react-router'

import { useSidebar } from '#/hooks/use-sidebar'
import { Sidebar } from './sidebar/sidebar'

// Layout principal de la aplicación: sidebar + área de contenido
export function AppLayout() {
  const { isFixed, isExpanded, toggle, onMouseEnter, onMouseLeave } =
    useSidebar()

  return (
    <div className="flex h-screen overflow-hidden bg-neutral-50 dark:bg-neutral-950">
      <Sidebar
        isFixed={isFixed}
        isExpanded={isExpanded}
        onToggle={toggle}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      />

      {/* Área de contenido principal */}
      <main className="flex-1 min-w-0 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}
