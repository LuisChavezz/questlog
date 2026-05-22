import { Outlet } from '@tanstack/react-router'

import { useSidebar } from '#/hooks/use-sidebar'
import { AppHeader } from './header/app-header'
import { Sidebar } from './sidebar/sidebar'

// Layout principal de la aplicación: sidebar + header + área de contenido
export function AppLayout() {
  const { isFixed, isExpanded, toggle, onMouseEnter, onMouseLeave } =
    useSidebar()

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar
        isFixed={isFixed}
        isExpanded={isExpanded}
        onToggle={toggle}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      />

      {/* Columna derecha: header sticky + área de contenido scrollable */}
      <div className="flex flex-1 min-w-0 flex-col">
        <AppHeader />
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
