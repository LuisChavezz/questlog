import { Moon, Sun } from 'lucide-react'

import { useTheme } from '#/components/providers/theme-provider'
import { cn } from '#/lib/utils'

interface ThemeSwitchProps {
  isExpanded: boolean
}

// - Modo colapsado: muestra el icono activo (decorativo, no interactivo).
// - Modo expandido: muestra la píldora con thumb deslizante y etiqueta.

export function ThemeSwitch({ isExpanded }: ThemeSwitchProps) {
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'

  return (
    <div className="shrink-0 px-2 py-3">
      <div
        className={cn(
          'flex items-center gap-3 rounded-lg px-3 py-2.5',
          'text-sm font-medium',
          'text-sidebar-foreground/60',
          'overflow-hidden',
        )}
      >
        {/* Ícono decorativo del tema activo */}
        <span
          aria-hidden="true"
          className="shrink-0 flex items-center justify-center size-4.5"
        >
          {isDark ? <Moon size={18} /> : <Sun size={18} />}
        </span>

        {/* Contenido visible solo en modo expandido: etiqueta + switch premium */}
        <div
          className={cn(
            'flex flex-1 items-center justify-between overflow-hidden',
            'transition-[max-width,opacity] duration-200 ease-in-out',
            isExpanded ? 'max-w-40 opacity-100' : 'max-w-0 opacity-0',
          )}
        >
          <span className="whitespace-nowrap text-sm">
            {isDark ? 'Modo oscuro' : 'Modo claro'}
          </span>
          
          {/* Switch de tema */}
          <button
            type="button"
            role="switch"
            aria-checked={isDark}
            aria-label="Alternar tema claro/oscuro"
            onClick={toggleTheme}
            tabIndex={isExpanded ? 0 : -1}
            className={cn(
              'relative shrink-0 flex items-center rounded-full',
              'w-14 h-7',
              'cursor-pointer',
              'transition-colors duration-300',
              isDark
                ? 'bg-sidebar-accent ring-1 ring-sidebar-border'
                : 'bg-background ring-1 ring-border shadow-sm',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            )}
          >
            {/* Icono fantasma: Sol (izquierda) — visible solo en modo oscuro */}
            <Sun
              size={12}
              strokeWidth={2}
              className={cn(
                'absolute left-1.75 shrink-0 transition-opacity duration-300',
                isDark ? 'opacity-40' : 'opacity-0',
              )}
              aria-hidden="true"
            />

            {/* Icono fantasma: Luna (derecha) — visible solo en modo claro */}
            <Moon
              size={12}
              strokeWidth={2}
              className={cn(
                'absolute right-1.75 shrink-0 transition-opacity duration-300',
                isDark ? 'opacity-0' : 'opacity-40',
              )}
              aria-hidden="true"
            />

            {/* Thumb deslizante con icono activo */}
            <span
              className={cn(
                'absolute flex items-center justify-center',
                'size-5 rounded-full',
                'bg-primary text-primary-foreground',
                'shadow-md transition-transform duration-300 ease-in-out',
                isDark ? 'translate-x-8' : 'translate-x-1',
              )}
              aria-hidden="true"
            >
              {isDark ? (
                <Moon size={10} strokeWidth={2.5} />
              ) : (
                <Sun size={10} strokeWidth={2.5} />
              )}
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}
