// @vitest-environment jsdom
// Regresión del filtro "Due date" (Overdue / Due soon / No due date) de la
// tabla de quests.
//
// Cubre las dos capas de la funcionalidad de fecha:
//   1. `isQuestOverdue` / `isQuestDueSoon` / `isQuestWithoutDueDate` — las
//      definiciones únicas de cada condición, con una fecha de referencia
//      explícita para no depender del reloj.
//   2. El `filterFn` REAL de la columna `dueDate` (vía createQuestsColumns),
//      ejercido con la misma maquinaria que la tabla (getFilteredRowModel):
//      una selección de una o varias opciones deja pasar solo las quests que
//      matchean CUALQUIERA de ellas (OR); una selección vacía no filtra nada
//      (mismo criterio que el resto de filtros multi-select).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createTable,
  getCoreRowModel,
  getFilteredRowModel,
} from '@tanstack/react-table'
import type { ColumnFiltersState } from '@tanstack/react-table'

import type { Quest, QuestStatus } from '#/db/schema'
import {
  isQuestDueSoon,
  isQuestOverdue,
  isQuestWithoutDueDate,
} from '../schemas/quest-schemas'
import { createQuestsColumns } from './quests-columns'

// Columnas reales del feature. La columna `dueDate` trae el `filterFn` bajo
// prueba; los permisos de guild no afectan al filtrado, así que se abren.
const columns = createQuestsColumns(() => {}, {
  members: [],
  onAssignmentChange: () => {},
  canManageQuest: () => true,
  canUpdateQuestStatus: () => true,
})

// Fechas muy lejanas para que el resultado no dependa de "hoy": una fecha del
// año 2000 está vencida y una del 2999 no lo está por muchos años.
const PAST_DUE = new Date(Date.UTC(2000, 0, 1))
const FUTURE_DUE = new Date(Date.UTC(2999, 11, 31))

function makeQuest(
  id: string,
  dueDate: Date | null,
  status: QuestStatus = 'todo',
): Quest {
  return {
    id,
    ownerId: 'owner',
    assigneeId: null,
    supervisorId: null,
    guildId: 'guild-1',
    title: id,
    description: null,
    status,
    priority: 'medium',
    tags: [],
    dueDate,
    completedAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  }
}

// Filtra `data` por el filtro de la columna `dueDate` con la MISMA maquinaria
// que la tabla real y devuelve los ids que sobreviven.
function filterByDueDate(data: Quest[], value: string[]): string[] {
  const columnFilters: ColumnFiltersState = [{ id: 'dueDate', value }]
  const table = createTable<Quest>({
    data,
    columns,
    state: { columnFilters },
    onStateChange: () => {},
    renderFallbackValue: null,
    getRowId: (quest) => quest.id,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })
  return table.getFilteredRowModel().rows.map((row) => row.original.id)
}

describe('isQuestOverdue', () => {
  // Fecha de referencia fija (2026-06-15) para que el test sea determinista.
  const today = new Date('2026-06-15T12:00:00.000Z')

  it('es true solo con fecha pasada y estado abierto', () => {
    const past = new Date(Date.UTC(2026, 5, 1)) // 2026-06-01, anterior a hoy
    expect(isQuestOverdue({ dueDate: past, status: 'todo' }, today)).toBe(true)
    expect(
      isQuestOverdue({ dueDate: past, status: 'in_progress' }, today),
    ).toBe(true)
    expect(isQuestOverdue({ dueDate: past, status: 'backlog' }, today)).toBe(
      true,
    )
  })

  it('es false para quests completadas o canceladas aunque la fecha haya pasado', () => {
    const past = new Date(Date.UTC(2026, 5, 1))
    expect(isQuestOverdue({ dueDate: past, status: 'done' }, today)).toBe(false)
    expect(isQuestOverdue({ dueDate: past, status: 'cancelled' }, today)).toBe(
      false,
    )
  })

  it('es false sin fecha de vencimiento y con fecha futura o de hoy', () => {
    expect(isQuestOverdue({ dueDate: null, status: 'todo' }, today)).toBe(false)
    const future = new Date(Date.UTC(2026, 11, 31))
    expect(isQuestOverdue({ dueDate: future, status: 'todo' }, today)).toBe(
      false,
    )
    // Vence hoy: no está vencida todavía (comparación estricta < hoy).
    const todayDue = new Date(Date.UTC(2026, 5, 15))
    expect(isQuestOverdue({ dueDate: todayDue, status: 'todo' }, today)).toBe(
      false,
    )
  })
})

describe('isQuestDueSoon', () => {
  // Misma fecha de referencia fija (2026-06-15) que `isQuestOverdue`.
  const today = new Date('2026-06-15T12:00:00.000Z')

  it('es true entre hoy y +3 días (ambos extremos inclusive), con estado abierto', () => {
    const dueToday = new Date(Date.UTC(2026, 5, 15))
    const dueInThreeDays = new Date(Date.UTC(2026, 5, 18))
    expect(isQuestDueSoon({ dueDate: dueToday, status: 'todo' }, today)).toBe(
      true,
    )
    expect(
      isQuestDueSoon({ dueDate: dueInThreeDays, status: 'in_progress' }, today),
    ).toBe(true)
  })

  it('es false fuera de la ventana: ya vencida o a más de +3 días', () => {
    const yesterday = new Date(Date.UTC(2026, 5, 14))
    const tooFarAhead = new Date(Date.UTC(2026, 5, 19))
    expect(isQuestDueSoon({ dueDate: yesterday, status: 'todo' }, today)).toBe(
      false,
    )
    expect(
      isQuestDueSoon({ dueDate: tooFarAhead, status: 'todo' }, today),
    ).toBe(false)
  })

  it('es false para quests completadas o canceladas aunque la fecha esté en la ventana', () => {
    const dueSoon = new Date(Date.UTC(2026, 5, 16))
    expect(isQuestDueSoon({ dueDate: dueSoon, status: 'done' }, today)).toBe(
      false,
    )
    expect(
      isQuestDueSoon({ dueDate: dueSoon, status: 'cancelled' }, today),
    ).toBe(false)
  })

  it('es false sin fecha de vencimiento', () => {
    expect(isQuestDueSoon({ dueDate: null, status: 'todo' }, today)).toBe(false)
  })
})

describe('isQuestWithoutDueDate', () => {
  it('es true solo cuando dueDate es null, sin importar el estado', () => {
    expect(isQuestWithoutDueDate({ dueDate: null })).toBe(true)
    expect(isQuestWithoutDueDate({ dueDate: new Date() })).toBe(false)
  })
})

describe('Filtro de columna "Due date"', () => {
  it('con ["overdue"] deja pasar solo las vencidas y abiertas', () => {
    const data = [
      makeQuest('overdue-open', PAST_DUE, 'in_progress'),
      makeQuest('overdue-done', PAST_DUE, 'done'),
      makeQuest('overdue-cancelled', PAST_DUE, 'cancelled'),
      makeQuest('future', FUTURE_DUE, 'todo'),
      makeQuest('no-date', null, 'todo'),
    ]

    expect(filterByDueDate(data, ['overdue'])).toEqual(['overdue-open'])
  })

  it('con selección vacía no filtra nada', () => {
    const data = [
      makeQuest('a', PAST_DUE, 'todo'),
      makeQuest('b', FUTURE_DUE, 'todo'),
      makeQuest('c', null, 'todo'),
    ]

    expect(filterByDueDate(data, [])).toEqual(['a', 'b', 'c'])
  })

  // Las opciones "Due soon" y "No due date" ejercitan el `filterFn` REAL, que
  // llama a `isQuestOverdue`/`isQuestDueSoon` SIN pasar una fecha de
  // referencia (usa `new Date()` — la hora "real" del reloj en el momento del
  // filtrado). Se congela el reloj del sistema para poder construir fechas
  // relativas a un "hoy" determinista, igual que si se pasara `referenceDate`
  // a mano en los tests de arriba.
  describe('con el reloj del sistema congelado en 2026-06-15', () => {
    const FROZEN_TODAY = new Date('2026-06-15T12:00:00.000Z')

    beforeEach(() => {
      vi.useFakeTimers()
      vi.setSystemTime(FROZEN_TODAY)
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('con ["due-soon"] deja pasar solo las de la ventana hoy..+3 días, abiertas', () => {
      const data = [
        makeQuest('due-today', new Date(Date.UTC(2026, 5, 15)), 'todo'),
        makeQuest('due-in-3-done', new Date(Date.UTC(2026, 5, 18)), 'done'),
        makeQuest('due-too-far', new Date(Date.UTC(2026, 5, 19)), 'todo'),
        makeQuest('overdue', PAST_DUE, 'todo'),
        makeQuest('no-date', null, 'todo'),
      ]

      expect(filterByDueDate(data, ['due-soon'])).toEqual(['due-today'])
    })

    it('con ["no-due-date"] deja pasar solo las que no tienen fecha, sin importar el estado', () => {
      const data = [
        makeQuest('no-date-open', null, 'todo'),
        makeQuest('no-date-done', null, 'done'),
        makeQuest('with-date', FUTURE_DUE, 'todo'),
      ]

      expect(filterByDueDate(data, ['no-due-date'])).toEqual([
        'no-date-open',
        'no-date-done',
      ])
    })

    it('con ["overdue", "due-soon"] combina ambas por OR', () => {
      const data = [
        makeQuest('overdue-open', PAST_DUE, 'in_progress'),
        makeQuest('due-soon-open', new Date(Date.UTC(2026, 5, 17)), 'todo'),
        makeQuest('too-far', new Date(Date.UTC(2026, 5, 30)), 'todo'),
        makeQuest('no-date', null, 'todo'),
      ]

      expect(filterByDueDate(data, ['overdue', 'due-soon'])).toEqual([
        'overdue-open',
        'due-soon-open',
      ])
    })

    it('con las tres opciones seleccionadas, deja pasar la unión de las tres', () => {
      const data = [
        makeQuest('overdue-open', PAST_DUE, 'in_progress'),
        makeQuest('due-soon-open', new Date(Date.UTC(2026, 5, 16)), 'todo'),
        makeQuest('no-date', null, 'todo'),
        makeQuest('future-with-date', FUTURE_DUE, 'todo'),
      ]

      expect(
        filterByDueDate(data, ['overdue', 'due-soon', 'no-due-date']),
      ).toEqual(['overdue-open', 'due-soon-open', 'no-date'])
    })
  })
})
