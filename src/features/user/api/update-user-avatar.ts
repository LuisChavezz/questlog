// Función de servidor — actualiza el avatar del usuario autenticado.
// Mismo patrón de auth/validación que las mutaciones de quests: verifica la
// sesión, valida el input con Zod y filtra el UPDATE por el id del usuario.
import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { eq } from 'drizzle-orm'

import { db } from '#/db'
import { user } from '#/db/schema'
import { auth } from '#/lib/auth'

import { updateUserAvatarSchema } from '../schemas/user-schemas'

export const updateUserAvatar = createServerFn({ method: 'POST' })
  .inputValidator(updateUserAvatarSchema)
  .handler(async ({ data }) => {
    // Verificar sesión activa
    const request = getRequest()
    const session = await auth.api.getSession({ headers: request.headers })

    if (!session?.user.id) {
      throw new Error('Unauthorized: must be signed in to update the avatar')
    }

    // El WHERE por id garantiza que cada usuario solo edita su propio registro
    const [updated] = await db
      .update(user)
      .set({ avatarId: data.avatarId, updatedAt: new Date() })
      .where(eq(user.id, session.user.id))
      .returning({ id: user.id, avatarId: user.avatarId })

    return updated
  })

export type UpdatedUserAvatar = NonNullable<
  Awaited<ReturnType<typeof updateUserAvatar>>
>
