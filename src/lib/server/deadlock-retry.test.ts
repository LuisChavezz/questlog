// @vitest-environment node
// Tests del reintento por deadlock. Lo que se fija aquí es el criterio de
// DETECCIÓN (dónde vive realmente el SQLSTATE cuando el error llega desde
// Drizzle) y el ALCANCE del reintento: exactamente un reintento, solo para
// `40P01`, y nunca dejando escapar el texto crudo de Postgres.
import { describe, expect, it, vi } from 'vitest'

import { isDeadlockError, withDeadlockRetry } from './deadlock-retry'

const CONFLICT = 'Conflict: the guild changed — please refresh and try again'

// Error del driver `pg`: el SQLSTATE viaja en `code`, no en el mensaje.
function driverError(code: string, message: string) {
  return Object.assign(new Error(message), { code })
}

// Error tal y como lo entrega Drizzle: envuelve el del driver en un
// `DrizzleQueryError` y lo deja en `cause`, así que el `code` NO está en la
// raíz. Es la forma que ve de verdad un handler.
function drizzleError(code: string, message: string) {
  return new Error('Failed query: delete from "guilds" where "id" = $1', {
    cause: driverError(code, message),
  })
}

function deadlock() {
  return drizzleError('40P01', 'deadlock detected')
}

describe('isDeadlockError', () => {
  it('reconoce el 40P01 envuelto por Drizzle, que es como llega en producción', () => {
    expect(isDeadlockError(deadlock())).toBe(true)
  })

  it('reconoce el 40P01 suelto del driver, sin envoltorio', () => {
    expect(isDeadlockError(driverError('40P01', 'deadlock detected'))).toBe(
      true,
    )
  })

  it('lo encuentra aunque esté anidado varios niveles', () => {
    const nested = new Error('outer', { cause: deadlock() })

    expect(isDeadlockError(nested)).toBe(true)
  })

  it('descarta otros SQLSTATE: solo el deadlock se reintenta', () => {
    // 23503 = foreign_key_violation, 40001 = serialization_failure. Ninguno es
    // un choque de bloqueos, así que ninguno debe entrar en el reintento.
    expect(isDeadlockError(drizzleError('23503', 'fk violation'))).toBe(false)
    expect(isDeadlockError(drizzleError('40001', 'could not serialize'))).toBe(
      false,
    )
  })

  it('descarta errores de dominio, que no llevan code', () => {
    expect(isDeadlockError(new Error('Conflict: ownership has changed'))).toBe(
      false,
    )
  })

  it('tolera valores no-Error sin romperse', () => {
    expect(isDeadlockError(null)).toBe(false)
    expect(isDeadlockError(undefined)).toBe(false)
    expect(isDeadlockError('40P01')).toBe(false)
  })

  it('no se cuelga con una cadena de causas cíclica', () => {
    // Un `cause` que apunta hacia atrás colgaría el recorrido sin el guard.
    const a: { cause?: unknown } = {}
    const b: { cause?: unknown } = { cause: a }
    a.cause = b

    expect(isDeadlockError(a)).toBe(false)
  })
})

describe('withDeadlockRetry', () => {
  it('no reintenta cuando la operación va bien a la primera', async () => {
    const run = vi.fn().mockResolvedValue('ok')

    await expect(withDeadlockRetry(run, CONFLICT)).resolves.toBe('ok')
    expect(run).toHaveBeenCalledOnce()
  })

  it('reintenta UNA vez tras un deadlock y devuelve el resultado del segundo intento', async () => {
    const run = vi
      .fn()
      .mockRejectedValueOnce(deadlock())
      .mockResolvedValue('ok')

    await expect(withDeadlockRetry(run, CONFLICT)).resolves.toBe('ok')
    expect(run).toHaveBeenCalledTimes(2)
  })

  it('con el deadlock persistente lanza el conflicto de dominio, sin filtrar el texto de Postgres', async () => {
    const run = vi.fn().mockRejectedValue(deadlock())

    const error = await withDeadlockRetry(run, CONFLICT).catch(
      (e: unknown) => e,
    )

    // Exactamente dos intentos: no insiste indefinidamente.
    expect(run).toHaveBeenCalledTimes(2)
    expect(error).toBeInstanceOf(Error)
    expect((error as Error).message).toBe(CONFLICT)
    // Lo esencial: «deadlock detected» no llega nunca al mensaje que ve la UI…
    expect((error as Error).message).not.toContain('deadlock')
    // …pero el original queda en `cause` para los logs.
    expect((error as Error).cause).toBeInstanceOf(Error)
    expect(isDeadlockError((error as Error).cause)).toBe(true)
  })

  it('propaga un error que no es deadlock tal cual y en el PRIMER intento', async () => {
    // Un conflicto de propiedad real debe fallar ya: reintentarlo solo
    // retrasaría el mismo rechazo, y reescribirlo perdería su causa.
    const ownershipConflict = new Error(
      'Conflict: ownership has already changed — please refresh and try again',
    )
    const run = vi.fn().mockRejectedValue(ownershipConflict)

    await expect(withDeadlockRetry(run, CONFLICT)).rejects.toBe(
      ownershipConflict,
    )
    expect(run).toHaveBeenCalledOnce()
  })

  it('propaga sin tocar un error de base de datos que no sea deadlock', async () => {
    const fkViolation = drizzleError('23503', 'fk violation')
    const run = vi.fn().mockRejectedValue(fkViolation)

    await expect(withDeadlockRetry(run, CONFLICT)).rejects.toBe(fkViolation)
    expect(run).toHaveBeenCalledOnce()
  })

  it('si el reintento falla por otra causa, gana ese error y no el mensaje de conflicto', async () => {
    // El primer intento muere en deadlock, pero el segundo descubre un estado
    // distinto: ese diagnóstico es más útil que un «refresh and try again».
    const secondFailure = new Error('Conflict: the guild was already deleted')
    const run = vi
      .fn()
      .mockRejectedValueOnce(deadlock())
      .mockRejectedValueOnce(secondFailure)

    await expect(withDeadlockRetry(run, CONFLICT)).rejects.toBe(secondFailure)
    expect(run).toHaveBeenCalledTimes(2)
  })
})
