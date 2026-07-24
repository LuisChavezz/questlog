// @vitest-environment jsdom
// Regresión: el título de la quest solo debe ser clickeable (botón, afordancia
// de hover, abre el drawer) cuando el caller provee `onOpenQuest` — la tarjeta
// del Overview. Dentro del modal de historial se omite adrede, y el título debe
// renderizarse como texto plano sin ningún elemento interactivo.
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, within } from '@testing-library/react'

import { ActivityLogEntry } from './activity-log-entry'
import type { GuildActivityLogEntry } from '../api/guild-activity-log-query'

const ENTRY: GuildActivityLogEntry = {
  id: 'log-1',
  questId: 'quest-1',
  questTitle: 'Slay the dragon',
  eventType: 'created',
  field: null,
  oldValue: null,
  newValue: null,
  createdAt: new Date(),
  actor: {
    userId: 'u-1',
    name: 'Ada Lovelace',
    image: null,
    avatarId: null,
    initials: 'AL',
  },
}

describe.each([
  { label: 'con onOpenQuest (tarjeta)', withOnOpenQuest: true },
  { label: 'sin onOpenQuest (modal)', withOnOpenQuest: false },
])('ActivityLogEntry — $label', ({ withOnOpenQuest }) => {
  it(
    withOnOpenQuest
      ? 'el título es un botón clickeable que invoca onOpenQuest'
      : 'el título se renderiza como texto plano, sin elemento interactivo',
    () => {
      const onOpenQuest = vi.fn()

      // Sin cleanup automático entre tests en este proyecto (no hay setupFiles
      // de testing-library), así que se consulta dentro del `container` propio
      // de cada render en vez de `screen` (que ve el body acumulado de ambos).
      const { container } = render(
        <ActivityLogEntry
          entry={ENTRY}
          members={[]}
          onOpenQuest={withOnOpenQuest ? onOpenQuest : undefined}
        />,
      )

      const title = within(container).getByText('Slay the dragon')

      if (withOnOpenQuest) {
        expect(title.tagName).toBe('BUTTON')
        fireEvent.click(title)
        expect(onOpenQuest).toHaveBeenCalledWith('quest-1')
      } else {
        expect(title.tagName).not.toBe('BUTTON')
        expect(title.closest('button')).toBeNull()
        expect(title.closest('a')).toBeNull()
        fireEvent.click(title)
        expect(onOpenQuest).not.toHaveBeenCalled()
      }
    },
  )
})
