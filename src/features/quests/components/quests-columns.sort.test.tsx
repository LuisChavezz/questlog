// @vitest-environment jsdom
// Regresión de ordenamiento para las columnas Assignee/Supervisor.
//
// El contrato de estas columnas tiene tres partes, y las tres se fijan aquí
// contra la definición REAL de columna (createQuestsColumns), no una copia:
//   1. Las filas sin asignar se agrupan SIEMPRE al final, en asc y en desc
//      (esto lo da `sortUndefined: 'last'`; se rompería si alguien lo quitara o
//      pasara a modo numérico, que las voltea al principio en desc).
//   2. Las filas asignadas se ordenan por nombre y se invierten en desc.
//   3. Entre sí, las filas sin asignar conservan un orden relativo ESTABLE y
//      determinista (su orden de entrada) — no un orden arbitrario. Este es el
//      punto de la corrección de antisimetría: el comparador devuelve 0 para dos
//      filas sin asignar (empate → desempate estable por índice), en vez de un
//      signo constante que dejaría su orden relativo indefinido.
import { describe, expect, it } from 'vitest'
import {
  createTable,
  getCoreRowModel,
  getSortedRowModel,
} from '@tanstack/react-table'
import type { SortingState } from '@tanstack/react-table'

import type { Quest } from '#/db/schema'
import { createQuestsColumns } from './quests-columns'
import type { MemberOption } from './member-select'

const MEMBERS: MemberOption[] = [
  { userId: 'u-ada', name: 'Ada' },
  { userId: 'u-bob', name: 'Bob' },
  { userId: 'u-zoe', name: 'Zoe' },
]

// Columnas reales del feature, con contexto de guild (permisos abiertos: los
// predicados no afectan al ordenamiento, solo a la edición inline).
const columns = createQuestsColumns(() => {}, {
  members: MEMBERS,
  onAssignmentChange: () => {},
  canManageQuest: () => true,
  canUpdateQuestStatus: () => true,
})

// Quest mínima pero completa para satisfacer el tipo; solo id/assigneeId influyen
// en el ordenamiento por la columna Assignee.
function makeQuest(id: string, assigneeId: string | null): Quest {
  return {
    id,
    ownerId: 'owner',
    assigneeId,
    supervisorId: null,
    guildId: 'guild-1',
    title: id,
    description: null,
    status: 'backlog',
    priority: 'medium',
    tags: [],
    dueDate: null,
    completedAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  }
}

// Ordena `data` por la columna Assignee usando la MISMA maquinaria que la tabla
// real (getSortedRowModel), y devuelve los ids en el orden resultante.
function sortByAssignee(data: Quest[], desc: boolean): string[] {
  const sorting: SortingState = [{ id: 'assigneeId', desc }]
  const table = createTable<Quest>({
    data,
    columns,
    state: { sorting },
    onStateChange: () => {},
    renderFallbackValue: null,
    getRowId: (quest) => quest.id,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })
  return table.getSortedRowModel().rows.map((row) => row.original.id)
}

describe('Guild quests columns — ordenamiento de Assignee', () => {
  it('agrupa las filas sin asignar al final en ambas direcciones', () => {
    const data = [
      makeQuest('n0', null),
      makeQuest('bob', 'u-bob'),
      makeQuest('n1', null),
      makeQuest('ada', 'u-ada'),
    ]

    // asc: asignadas por nombre (Ada, Bob), luego las sin asignar.
    expect(sortByAssignee(data, false)).toEqual(['ada', 'bob', 'n0', 'n1'])
    // desc: asignadas invertidas (Bob, Ada), pero las sin asignar SIGUEN al final
    // (no se voltean al principio) — este es el flip que sortUndefined evita.
    expect(sortByAssignee(data, true)).toEqual(['bob', 'ada', 'n0', 'n1'])
  })

  it('mantiene estable el orden relativo de varias filas sin asignar', () => {
    // Cuatro filas sin asignar en un orden de entrada concreto, intercaladas.
    const data = [
      makeQuest('n2', null),
      makeQuest('zoe', 'u-zoe'),
      makeQuest('n0', null),
      makeQuest('n3', null),
      makeQuest('ada', 'u-ada'),
      makeQuest('n1', null),
    ]

    // En ambas direcciones, las cuatro sin asignar conservan su orden de ENTRADA
    // (n2, n0, n3, n1) — no un orden arbitrario ni invertido. Sin la corrección,
    // el comparador daría un signo constante para cada par sin-asignar y su orden
    // relativo quedaría a merced del algoritmo de sort.
    const asc = sortByAssignee(data, false)
    const desc = sortByAssignee(data, true)

    expect(asc.filter((id) => id.startsWith('n'))).toEqual([
      'n2',
      'n0',
      'n3',
      'n1',
    ])
    expect(desc.filter((id) => id.startsWith('n'))).toEqual([
      'n2',
      'n0',
      'n3',
      'n1',
    ])
  })

  it('es determinista y estable al reordenar repetidamente', () => {
    const data = [
      makeQuest('n0', null),
      makeQuest('n1', null),
      makeQuest('zoe', 'u-zoe'),
      makeQuest('n2', null),
      makeQuest('ada', 'u-ada'),
    ]

    // Reordenar el mismo input varias veces da siempre el mismo resultado...
    const once = sortByAssignee(data, false)
    expect(sortByAssignee(data, false)).toEqual(once)
    expect(sortByAssignee(data, false)).toEqual(once)

    // ...y re-ordenar un resultado ya ordenado es idempotente (no reordena las
    // filas sin asignar), la señal observable de un comparador antisimétrico.
    const reordered = once.map((id) => data.find((quest) => quest.id === id)!)
    expect(sortByAssignee(reordered, false)).toEqual(once)
  })

  // Cobertura del refactor de #13: el sort resuelve el NOMBRE del miembro (vía el
  // índice userId→nombre) y ordena por él, no por el userId. Los miembros de aquí
  // tienen el orden de userId opuesto al de su nombre a propósito, para que un
  // fallo en la resolución del nombre cambie el resultado.
  it('ordena por el nombre del miembro, no por su userId', () => {
    const invertedMembers: MemberOption[] = [
      { userId: 'u-1', name: 'Zara' },
      { userId: 'u-2', name: 'Alice' },
      { userId: 'u-3', name: null }, // sin nombre → cae a 'Unknown member'
    ]
    const invertedColumns = createQuestsColumns(() => {}, {
      members: invertedMembers,
      onAssignmentChange: () => {},
      canManageQuest: () => true,
      canUpdateQuestStatus: () => true,
    })

    const sortInverted = (data: Quest[]) => {
      const table = createTable<Quest>({
        data,
        columns: invertedColumns,
        state: { sorting: [{ id: 'assigneeId', desc: false }] },
        onStateChange: () => {},
        renderFallbackValue: null,
        getRowId: (quest) => quest.id,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
      })
      return table.getSortedRowModel().rows.map((row) => row.original.id)
    }

    // Entrada en orden de userId (u-1, u-2, u-3); la salida debe seguir el nombre:
    // Alice (u-2), Unknown member (u-3), Zara (u-1).
    const data = [
      makeQuest('zara', 'u-1'),
      makeQuest('alice', 'u-2'),
      makeQuest('unknown', 'u-3'),
    ]

    expect(sortInverted(data)).toEqual(['alice', 'unknown', 'zara'])
  })
})
