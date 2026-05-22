import { useRouter } from '@tanstack/react-router'
import { useState } from 'react'

import { authClient } from '#/lib/auth-client'

// Hook que encapsula la lógica de cierre de sesión con Better Auth.
// Retorna el handler de logout y un flag de estado pendiente.
export function useLogout() {
  const router = useRouter()
  const queryClient = router.options.context.queryClient
  const [isPending, setIsPending] = useState(false)

  const logout = async () => {
    if (isPending) {
      return false
    }

    setIsPending(true)

    try {
      const { error } = await authClient.signOut()

      if (error) {
        return false
      }

      // Limpia datos sensibles y fuerza la revalidación de guards/loaders.
      queryClient.clear()
      await router.invalidate({ sync: true })
      await router.navigate({ to: '/login', replace: true })

      return true
    } finally {
      setIsPending(false)
    }
  }

  return { logout, isPending }
}
