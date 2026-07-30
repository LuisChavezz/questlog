// @vitest-environment node
// Tests de `guildNameSchema`. Fijan que el nombre se RECORTA antes de validarse,
// que es lo que impide guardar un nombre en blanco.
//
// Por qué importa más allá de la estética: el diálogo de borrado exige teclear
// el nombre del guild y compara contra el nombre recortado. Un nombre de solo
// espacios colapsaba a cadena vacía, y el guard del diálogo —correcto: se niega
// a aceptar «vacío coincide con vacío» como confirmación— dejaba el botón
// deshabilitado para siempre. Resultado: un guild imposible de borrar desde la
// UI. Se corta en el origen, rechazando ese nombre al crearlo.
import { describe, expect, it } from 'vitest'

import { createGuildSchema, guildNameSchema } from './guild-schemas'

describe('guildNameSchema — recorte previo a la validación', () => {
  it('rechaza un nombre de solo espacios', () => {
    const result = guildNameSchema.safeParse('   ')

    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toBe('Name is required')
  })

  it('rechaza también tabuladores y saltos de línea', () => {
    // Cualquier blanco que `String.prototype.trim` elimine cuenta: si pasara,
    // el nombre guardado volvería a colapsar a vacío en el diálogo.
    expect(guildNameSchema.safeParse('\t\n  ').success).toBe(false)
  })

  it('sigue rechazando la cadena vacía', () => {
    expect(guildNameSchema.safeParse('').success).toBe(false)
  })

  it('recorta los extremos y devuelve el nombre ya limpio', () => {
    // El valor de SALIDA es el que se guarda, así que el recorte llega a la DB.
    const result = guildNameSchema.safeParse('  Dev Guild  ')

    expect(result.success).toBe(true)
    expect(result.data).toBe('Dev Guild')
  })

  it('conserva los espacios interiores', () => {
    // Solo se recortan los extremos: colapsar el interior sería una regla de
    // normalización nueva, y el diálogo de borrado tampoco la aplica.
    expect(guildNameSchema.parse('Dev  Guild')).toBe('Dev  Guild')
  })

  it('respeta las mayúsculas tal cual', () => {
    // El diálogo de borrado compara sensible a mayúsculas contra este valor.
    expect(guildNameSchema.parse('DEV Guild')).toBe('DEV Guild')
  })

  it('mide el máximo sobre el nombre YA recortado', () => {
    const maxLengthName = 'a'.repeat(100)

    expect(guildNameSchema.safeParse(`  ${maxLengthName}  `).success).toBe(true)
    expect(guildNameSchema.safeParse('a'.repeat(101)).success).toBe(false)
  })
})

describe('guildNameSchema — consistencia con la confirmación de borrado', () => {
  it('nunca produce un nombre que el diálogo de borrado colapse a vacío', () => {
    // La propiedad que cierra el bug: todo nombre que el esquema ACEPTA sigue
    // siendo no vacío tras el `trim()` que aplica el diálogo, así que el botón
    // de confirmar siempre tiene una frase real contra la que compararse.
    const candidates = ['Dev Guild', '  Dev Guild  ', '\tDev Guild\n', 'a']

    for (const candidate of candidates) {
      const stored = guildNameSchema.parse(candidate)

      expect(stored.trim()).toBe(stored)
      expect(stored.trim()).not.toBe('')
    }
  })
})

describe('createGuildSchema', () => {
  it('rechaza la creación con un nombre en blanco', () => {
    // Mismo esquema, así que la puerta vale tanto en el validador de campo del
    // formulario como en el `inputValidator` del servidor.
    const result = createGuildSchema.safeParse({
      name: '   ',
      slug: 'my-guild',
      description: undefined,
    })

    expect(result.success).toBe(false)
  })

  it('guarda el nombre recortado cuando trae espacios de sobra', () => {
    const result = createGuildSchema.parse({
      name: '  Dev Guild  ',
      slug: 'dev-guild',
      description: undefined,
    })

    expect(result.name).toBe('Dev Guild')
  })
})
