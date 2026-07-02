// Hook de mutación para actualizar el avatar del usuario con update optimista.
//
// El usuario actual vive en el store de sesión de Better Auth (el mismo que lee
// `authClient.useSession()`). Por eso, en vez de invalidar una query de React
// Query, parcheamos ese store de forma optimista y luego revalidamos la sesión
// contra el servidor — mismo espíritu que el patrón optimista de quests
// (snapshot -> patch -> rollback en error -> invalidación en settled).
//
// Todo el acceso al store INTERNO de Better Auth queda encapsulado en
// `#/lib/auth-session-store` (ver ahí el porqué —`avatarId` es `input: false`— y
// el riesgo de que esos internos cambien en una actualización).
import { useMutation } from '@tanstack/react-query'

import {
  broadcastSessionUpdateToOtherTabs,
  patchSessionUser,
  restoreSession,
  revalidateSession,
  snapshotSession,
} from '#/lib/auth-session-store'
import type { SessionSnapshot } from '#/lib/auth-session-store'

import { updateUserAvatar } from '../api/update-user-avatar'

// Contexto que viaja de onMutate a onError para poder revertir
type MutationContext = { previous: SessionSnapshot }

export function useUpdateUserAvatar(onSuccess?: () => void) {
  return useMutation({
    mutationFn: (avatarId: string | null) =>
      updateUserAvatar({ data: { avatarId } }),

    onMutate: (avatarId): MutationContext => {
      // Snapshot del estado previo de la sesión para poder revertir
      const previous = snapshotSession()

      // Parche optimista: refleja el avatar nuevo de inmediato en toda la app
      patchSessionUser({ avatarId })

      return { previous }
    },

    onError: (_error, _avatarId, context) => {
      // Revertir al snapshot si la mutación falla
      if (context?.previous) {
        restoreSession(context.previous)
      }
    },

    onSettled: () => {
      // Revalidar la sesión desde el servidor para confirmar el estado real
      revalidateSession()
    },

    onSuccess: () => {
      // La escritura en el servidor se confirmó: notificar a las demás pestañas
      // para que recojan el avatar nuevo (el parche optimista y la revalidación
      // solo actualizan la pestaña actual). Solo aquí —no en onSettled— para no
      // difundir cuando la mutación falló y se revirtió.
      broadcastSessionUpdateToOtherTabs()

      onSuccess?.()
    },
  })
}
