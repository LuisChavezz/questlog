// Único punto de acceso al store de sesión INTERNO de Better Auth.
//
// `authClient.$store.atoms.session` y la señal `'$sessionSignal'` NO son API
// pública: son internos de Better Auth y podrían renombrarse o cambiar de forma
// en una actualización, SIN que TypeScript lo detecte (la firma de `notify` es
// `(signal: string)`, así que un typo o un rename compila igual). Los
// concentramos aquí para tener exactamente un lugar que arreglar si eso pasa.
//
// ¿Por qué tocar internos en vez de la API pública, como sí hace
// `use-update-user.ts` con `authClient.updateUser`? Porque `avatarId` está
// declarado con `input: false` en `src/lib/auth.ts` (líneas 24-30): el cliente
// tiene prohibido escribirlo vía `authClient.updateUser({ avatarId })` a
// propósito, para que solo el servidor pueda asignarlo. Sin esa vía pública, la
// única forma de reflejar el cambio de avatar de inmediato (parche optimista) es
// escribir el atom de sesión directamente.
import { authClient } from '#/lib/auth-client'

// Atom de sesión de Better Auth: fuente de verdad del usuario actual en cliente
// (el mismo que lee `authClient.useSession()`).
const sessionAtom = authClient.$store.atoms.session

// Valor completo del atom (data/error/isPending/…). Opaco a propósito: el
// llamador solo lo usa como token de snapshot para revertir.
export type SessionSnapshot = ReturnType<typeof sessionAtom.get>

type SessionData = NonNullable<SessionSnapshot['data']>

// Snapshot del estado actual de la sesión para poder revertir un parche optimista.
export function snapshotSession(): SessionSnapshot {
  return sessionAtom.get()
}

// Restaura un snapshot previo (rollback tras un error de mutación).
export function restoreSession(snapshot: SessionSnapshot): void {
  sessionAtom.set(snapshot)
}

// Parche optimista: mezcla campos parciales del usuario en la sesión actual para
// reflejar el cambio de inmediato en toda la app. No-op si aún no hay usuario.
export function patchSessionUser(
  partialUser: Partial<SessionData['user']>,
): void {
  const previous = sessionAtom.get()
  const current = previous?.data

  if (!current?.user) return

  sessionAtom.set({
    ...previous,
    data: { ...current, user: { ...current.user, ...partialUser } },
  })
}

// Revalida la sesión contra el servidor tras una escritura del backend.
//
// Alterna la señal interna, que dispara el refetch de `/get-session` y actualiza
// el atom reactivo que consumen `useSession()` y la UI (p. ej. el avatar del
// header) SIN recargar la página.
//
// OJO: la API pública `authClient.getSession()` NO sirve como reemplazo. Hace su
// propio fetch y devuelve datos frescos al llamador, pero `/get-session` no está
// en los `atomListeners` de Better Auth, así que no alterna esta señal y por lo
// tanto no escribe el atom reactivo. Usarla degradaría la revalidación (la UI se
// quedaría con el valor optimista hasta un reload). Por eso conservamos `notify`.
//
// OJO 2: `notify` solo afecta a ESTA pestaña (es un toggle en memoria del
// nanostore). NO notifica a otras pestañas del mismo usuario; para eso está
// `broadcastSessionUpdateToOtherTabs` (ver abajo).
export function revalidateSession(): void {
  authClient.$store.notify('$sessionSignal')
}

// Clave y forma del mensaje del canal de difusión INTERNO de Better Auth
// (WindowBroadcastChannel, en `better-auth/dist/client/broadcast-channel.mjs`).
// El canal es en realidad un `localStorage.setItem` sobre esta clave; cada OTRA
// pestaña tiene un listener de `storage` que, al ver un mensaje `session`,
// refresca su sesión. Igual que el resto de este módulo, son internos sin
// garantía de estabilidad: si Better Auth cambia la clave o la forma, este es el
// único lugar a ajustar.
const BETTER_AUTH_BROADCAST_KEY = 'better-auth.message'

// Notifica a OTRAS pestañas del mismo origen que la sesión cambió, para que
// recojan el valor fresco (p. ej. el avatar recién escrito por el servidor) sin
// recargar la página.
//
// ¿Por qué hace falta esto? Cuando un cambio pasa por la API pública de Better
// Auth (`authClient.updateUser`, p. ej. el `name`), la librería difunde el
// cambio a las demás pestañas ella sola: al pegarle a `/update-user` escribe la
// clave de arriba y el listener de cada OTRA pestaña refresca su sesión. Pero el
// avatar NO pasa por esa API (avatarId es `input: false`): se escribe con un
// UPDATE directo en el servidor, y el parche optimista + `revalidateSession()`
// solo tocan la pestaña actual. Sin esta difusión manual, las demás pestañas se
// quedan con el avatar viejo hasta su propio refetch (focus/poll/reload).
//
// Replicamos exactamente el mensaje que Better Auth emite en ese caso para que
// el listener YA existente de las otras pestañas lo procese sin cambios (no
// necesitamos un listener propio). El evento `storage` NO se dispara en la
// pestaña que escribe, así que esto NO afecta a la pestaña actual (que ya se
// actualizó con el parche optimista). El `clientId`/`timestamp` aleatorios
// garantizan que cada escritura cambie el valor y dispare el evento.
export function broadcastSessionUpdateToOtherTabs(): void {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.setItem(
      BETTER_AUTH_BROADCAST_KEY,
      JSON.stringify({
        event: 'session',
        data: { trigger: 'updateUser' },
        clientId: Math.random().toString(36).substring(7),
        timestamp: Math.floor(Date.now() / 1000),
      }),
    )
  } catch {
    // localStorage puede fallar (modo privado, cuota); la difusión es best-effort
  }
}
