import { useCallback, useState } from 'react'

interface UseSidebarReturn {
  isExpanded: boolean
  toggle: () => void
}

// Gestiona el estado de expansión del sidebar.
// El sidebar solo se expande o colapsa mediante el botón de toggle; sin hover.
export function useSidebar(): UseSidebarReturn {
  const [isExpanded, setIsExpanded] = useState(false)

  const toggle = useCallback(() => {
    setIsExpanded((prev) => !prev)
  }, [])

  return { isExpanded, toggle }
}
