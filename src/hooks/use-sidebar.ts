import { useCallback, useState } from 'react'

interface UseSidebarReturn {
  isFixed: boolean
  isExpanded: boolean
  toggle: () => void
  onMouseEnter: () => void
  onMouseLeave: () => void
}

// Gestiona el estado de expansión del sidebar:
// - isFixed: expandido de forma fija (empuja el contenido)
// - hover: expandido temporalmente como overlay (sin empujar contenido)
export function useSidebar(): UseSidebarReturn {
  const [isFixed, setIsFixed] = useState(false)
  const [isHovered, setIsHovered] = useState(false)

  const isExpanded = isFixed || isHovered

  // Alterna entre fijo-expandido y colapsado
  const toggle = useCallback(() => {
    setIsFixed((prev) => !prev)
    setIsHovered(false)
  }, [])

  // Al entrar con el mouse, expande temporalmente solo si no está fijo
  const onMouseEnter = useCallback(() => {
    if (!isFixed) setIsHovered(true)
  }, [isFixed])

  // Al salir, quita el hover (si está fijo, isExpanded sigue siendo true)
  const onMouseLeave = useCallback(() => {
    setIsHovered(false)
  }, [])

  return {
    isFixed,
    isExpanded,
    toggle,
    onMouseEnter,
    onMouseLeave,
  }
}
