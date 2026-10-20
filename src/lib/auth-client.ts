import { createAuthClient } from 'better-auth/react'
import { inferAdditionalFields } from 'better-auth/client/plugins'

// El cliente de auth solo hace peticiones en el navegador: `useSession()` no
// pide la sesión durante SSR (Better Auth omite el fetch sin `window`) y el
// resto de llamadas (signIn, signUp, signOut, updateUser) viven en handlers de
// eventos. La sesión del lado del servidor se lee con `auth.api.getSession` en
// server functions (`getServerSession`), nunca con este cliente. Por eso el
// baseURL es siempre el origen de la página y, en el servidor, se deja sin
// definir en vez de inventar una URL (antes caía en localhost en silencio).
export const authClient = createAuthClient({
  baseURL: typeof window !== 'undefined' ? window.location.origin : undefined,
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
