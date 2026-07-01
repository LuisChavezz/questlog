// Hook de mutación para actualizar el avatar del usuario con update optimista.
//
// El usuario actual vive en el atom de sesión de Better Auth (el mismo que lee
// `authClient.useSession()`). Por eso, en vez de invalidar una query de React
// Query, parcheamos ese atom de forma optimista y luego revalidamos la sesión
// contra el servidor — mismo espíritu que el patrón optimista de quests
// (snapshot -> patch -> rollback en error -> invalidación en settled).
import { useMutation } from '@tanstack/react-query'

import { authClient } from '#/lib/auth-client'

import { updateUserAvatar } from '../api/update-user-avatar'

// Atom de sesión de Better Auth: fuente de verdad del usuario actual en cliente
const sessionAtom = authClient.$store.atoms.session

// Contexto que viaja de onMutate a onError para poder revertir
type MutationContext = { previous: unknown }

export function useUpdateUserAvatar(onSuccess?: () => void) {
  return useMutation({
    mutationFn: (avatarId: string | null) =>
      updateUserAvatar({ data: { avatarId } }),

    onMutate: (avatarId): MutationContext => {
      // Snapshot del estado previo de la sesión para poder revertir
      const previous = sessionAtom.get()
      const current = previous?.data

      // Parche optimista: refleja el avatar nuevo de inmediato en toda la app
      if (current?.user) {
        sessionAtom.set({
          ...previous,
          data: { ...current, user: { ...current.user, avatarId } },
        })
      }

      return { previous }
    },

    onError: (_error, _avatarId, context) => {
      // Revertir al snapshot si la mutación falla
      if (context?.previous) {
        sessionAtom.set(context.previous)
      }
    },

    onSettled: () => {
      // Revalidar la sesión desde el servidor para confirmar el estado real
      authClient.$store.notify('$sessionSignal')
    },

    onSuccess: () => {
      onSuccess?.()
    },
  })
}
