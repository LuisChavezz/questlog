import { createAuthClient } from 'better-auth/react'
import { inferAdditionalFields } from 'better-auth/client/plugins'

export const authClient = createAuthClient({
  baseURL:
    typeof window !== 'undefined'
      ? window.location.origin
      : (import.meta.env.VITE_APP_URL ?? 'http://localhost:3000'),
  plugins: [
    // Expone en el cliente (con tipado) los campos extra del usuario definidos
    // en el servidor. Debe mantenerse en sync con `additionalFields` de auth.ts.
    inferAdditionalFields({
      user: {
        avatarId: { type: 'string', required: false },
      },
    }),
  ],
})
