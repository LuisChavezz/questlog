import { Outlet } from '@tanstack/react-router'

import { TooltipProvider } from '#/components/ui/tooltip'
import { useSidebar } from '#/hooks/use-sidebar'
import { AppHeader } from './header/app-header'
import { Sidebar } from './sidebar/sidebar'

// Layout principal de la aplicación: sidebar + header + área de contenido.
// TooltipProvider envuelve todo el layout (no solo el sidebar) para que
// cualquier <Tooltip> del área de contenido — p. ej. los avatares de
// asignado/supervisor en la tabla de quests — tenga el contexto que necesita.
export function AppLayout() {
  const { isExpanded, toggle } = useSidebar()

  return (
    <TooltipProvider>
      <div className="flex h-screen overflow-hidden bg-background">
        <Sidebar isExpanded={isExpanded} onToggle={toggle} />

        {/* Columna derecha: header sticky + área de contenido scrollable */}
        <div className="flex flex-1 min-w-0 flex-col">
          <AppHeader />
          <main className="flex-1 overflow-y-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </TooltipProvider>
  )
}
