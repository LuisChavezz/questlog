// @vitest-environment node
// Fija el contrato del invalidador compartido: qué claves de caché marca como
// obsoletas tras editar/borrar una quest de guild, según `includePersonalQuests`.
// Es la fuente única que usan la tabla de quests y el drawer del Overview, así
// que su comportamiento se testea aquí una vez en vez de en cada llamador.
import { describe, expect, it, vi } from 'vitest'
import type { QueryClient } from '@tanstack/react-query'

import { invalidateGuildQuestCaches } from './invalidate-guild-quest-caches'

// Cliente mínimo: solo interesa sobre qué claves se llama a `invalidateQueries`.
function makeClient() {
  return { invalidateQueries: vi.fn() }
}

describe('invalidateGuildQuestCaches', () => {
  it('invalida el detalle del guild y la lista personal cuando includePersonalQuests', () => {
    const client = makeClient()

    invalidateGuildQuestCaches(client as unknown as QueryClient, 'my-guild', {
      includePersonalQuests: true,
    })

    expect(client.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['guild', 'my-guild'],
    })
    expect(client.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['quests'],
    })
    expect(client.invalidateQueries).toHaveBeenCalledTimes(2)
  })

  it('omite la lista personal cuando includePersonalQuests es false', () => {
    const client = makeClient()

    invalidateGuildQuestCaches(client as unknown as QueryClient, 'my-guild', {
      includePersonalQuests: false,
    })

    expect(client.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['guild', 'my-guild'],
    })
    expect(client.invalidateQueries).toHaveBeenCalledTimes(1)
  })
})
