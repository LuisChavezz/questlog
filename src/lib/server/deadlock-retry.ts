// Reintento acotado para transacciones que Postgres aborta por DEADLOCK.
//
// Por qué hace falta: dos handlers toman los mismos dos bloqueos en orden
// INVERSO, así que pueden cerrarse en círculo y Postgres mata a uno de los dos.
//
//   delete-guild  → `guilds` FOR UPDATE y, al borrar, la cascada de la FK baja
//                   a las filas de `quests` del guild        (guilds → quests)
//   update-quest  → `quests` FOR UPDATE y, al insertar en
//                   `guild_quest_activity_log`, el trigger de su FK toma
//                   FOR KEY SHARE sobre `guilds`             (quests → guilds)
//
// Se resuelve REINTENTANDO, no reordenando los bloqueos: el orden de cada
// handler es el que necesitan sus propios invariantes (delete-guild bloquea
// `guilds` primero para serializarse contra la transferencia de propiedad, que
// usa ese mismo orden), y tocarlo movería el problema a otra pareja. Un
// deadlock además es transitorio por definición: la víctima ya no sostiene nada
// cuando aborta, así que repetir la transacción entera —bloqueo y
// reverificación incluidos— basta para que la segunda pasada gane.

// SQLSTATE de Postgres para `deadlock detected`. Es el ÚNICO código que se
// reintenta: ensanchar esto a "cualquier fallo de transacción" enmascararía
// errores reales (un conflicto de propiedad debe fallar ya, no repetirse).
const DEADLOCK_DETECTED = '40P01'

/**
 * ¿Este error viene de un deadlock de Postgres? El `code` no está en la raíz:
 * Drizzle envuelve el error del driver en un `DrizzleQueryError` y deja el
 * original (el de `pg`, que sí lo lleva) en `cause`. Por eso se recorre la
 * cadena de causas en vez de mirar solo el error de fuera. El `Set` corta las
 * cadenas cíclicas, que si no colgarían el bucle.
 */
export function isDeadlockError(error: unknown): boolean {
  const seen = new Set<unknown>()
  let current: unknown = error

  while (
    current !== null &&
    typeof current === 'object' &&
    !seen.has(current)
  ) {
    seen.add(current)

    if ((current as { code?: unknown }).code === DEADLOCK_DETECTED) {
      return true
    }

    current = (current as { cause?: unknown }).cause
  }

  return false
}

/**
 * Ejecuta `run` y, si Postgres lo abortó por deadlock, lo repite UNA vez.
 *
 * Cualquier otro error se propaga tal cual y en el primer intento — sin
 * reintento y sin reescribir el mensaje— para no enmascarar fallos reales.
 * Si el reintento vuelve a caer en deadlock se lanza `conflictMessage`, de modo
 * que el texto crudo de Postgres («deadlock detected») no llegue nunca a la UI;
 * el error original queda en `cause` para los logs.
 */
export async function withDeadlockRetry<T>(
  run: () => Promise<T>,
  conflictMessage: string,
): Promise<T> {
  try {
    return await run()
  } catch (error) {
    if (!isDeadlockError(error)) throw error

    try {
      return await run()
    } catch (retryError) {
      if (!isDeadlockError(retryError)) throw retryError

      throw new Error(conflictMessage, { cause: retryError })
    }
  }
}
