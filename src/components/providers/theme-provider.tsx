import { useEffect } from 'react'
import { useThemeStore } from '#/stores/theme-store'
import type { ThemeStore } from '#/stores/theme-store'

// Re-exporta los tipos del store para compatibilidad con el resto de la app
export type { Theme, ThemeStore } from '#/stores/theme-store'

// Hook que delega al store de Zustand con la misma interfaz que antes
export function useTheme(): ThemeStore {
  return useThemeStore()
}

interface ThemeProviderProps {
  children: React.ReactNode
}

// ThemeProvider: aplica la clase 'dark' al <html> cuando cambia el tema.
// La persistencia en localStorage es gestionada por el middleware de Zustand.
export function ThemeProvider({ children }: ThemeProviderProps) {
  const theme = useThemeStore((s) => s.theme)

  useEffect(() => {
    const root = document.documentElement
    root.classList.remove('light', 'dark')
    root.classList.add(theme)
  }, [theme])

  return <>{children}</>
}
