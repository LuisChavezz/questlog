// @vitest-environment node
// Tests de `getSafeRedirect`: la única barrera contra un open-redirect tras
// iniciar sesión o registrarse. Se fija cada variante conocida de URL externa
// disfrazada de ruta interna, más los destinos internos legítimos que deben
// sobrevivir intactos (incluido el search de un deep link).
import { describe, expect, it } from 'vitest'

import { getSafeRedirect } from './auth-schemas'

const DEFAULT = '/quests'

describe('getSafeRedirect — destinos internos', () => {
  it.each([
    '/quests',
    '/guilds/my-guild/members',
    '/invite/AbCd2345',
    '/guilds/my-guild/quests?status=todo&overdue=true',
    '/quests#top',
    '/quests?tag=a%20b',
    // Barra invertida codificada en el SEARCH: valor de filtro legítimo
    '/quests?q=C%5Cpath',
    // '//' en el search o el hash no cambia de host
    '/quests?next=%2F%2Fevil.com',
    '/quests#//section',
  ])('conserva %s', (target) => {
    expect(getSafeRedirect(target)).toBe(target)
  })

  it('usa el destino por defecto sin redirect', () => {
    expect(getSafeRedirect(undefined)).toBe(DEFAULT)
    expect(getSafeRedirect('')).toBe(DEFAULT)
  })
})

describe('getSafeRedirect — destinos externos o ambiguos', () => {
  it.each([
    ['protocol-relative', '//evil.com'],
    ['protocol-relative con ruta', '//evil.com/quests'],
    ['barra invertida tras la barra', '/\\evil.com'],
    ['doble barra invertida', '\\\\evil.com'],
    ['barra invertida inicial', '\\evil.com'],
    ['barra invertida codificada', '/%5Cevil.com'],
    ['barra invertida codificada en minúsculas', '/%5cevil.com'],
    ['doble barra codificada', '%2F%2Fevil.com'],
    ['barra + barra codificada', '/%2Fevil.com'],
    ['tabulador entre barras', '/\t/evil.com'],
    ['salto de línea entre barras', '/\n/evil.com'],
    ['tabulador codificado', '/%09/evil.com'],
    ['URL absoluta https', 'https://evil.com'],
    ['URL absoluta http', 'http://evil.com/quests'],
    ['esquema javascript', 'javascript:alert(1)'],
    ['ruta relativa sin barra', 'quests'],
    ['escape malformado', '/%E0%A4%A'],
    ['protocol-relative con search', '//evil.com?next=/quests'],
    ['barra invertida con hash', '/\\evil.com#section'],
    ['barra invertida codificada con search', '/%5Cevil.com?q=1'],
  ])('rechaza %s', (_label, target) => {
    expect(getSafeRedirect(target)).toBe(DEFAULT)
  })
})
