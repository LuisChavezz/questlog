// @vitest-environment node
// Fija por reflexión sobre el esquema de Drizzle las decisiones de ciclo de
// vida de `guild_quest_comments`: el hilo muere con la quest, sobrevive al
// borrado del autor (SET NULL) y NO referencia `guilds` (el guild se deriva de
// la quest). También fija la precisión de milisegundos de la que depende el
// cursor de paginación y el índice que lo recorre.
import { describe, expect, it } from 'vitest'
import { getTableName } from 'drizzle-orm'
import type { SQL } from 'drizzle-orm'
import { getTableConfig, PgDialect } from 'drizzle-orm/pg-core'

import { guildQuestComments } from '#/db/schema'

const config = getTableConfig(guildQuestComments)

// Describe una FK como { hacia, columna destino, acción }, mismo formato que
// guild-cascade.test.ts.
function describeForeignKey(columnName: string) {
  const fk = config.foreignKeys.find((candidate) =>
    candidate.reference().columns.some((ref) => ref.name === columnName),
  )
  if (!fk) return null

  const reference = fk.reference()
  return {
    references: getTableName(reference.foreignTable),
    referencesColumn: reference.foreignColumns[0]?.name,
    onDelete: fk.onDelete,
  }
}

// Precisión declarada de una columna timestamp (`PgTimestamp.precision`).
function precisionOf(name: string) {
  return (column(name) as unknown as { precision?: number }).precision
}

function column(name: string) {
  const found = config.columns.find((candidate) => candidate.name === name)
  if (!found) throw new Error(`No column "${name}"`)
  return found
}

describe('guild_quest_comments — claves foráneas', () => {
  it('quest_id cae con la quest (CASCADE)', () => {
    expect(describeForeignKey('quest_id')).toEqual({
      references: 'quests',
      referencesColumn: 'id',
      onDelete: 'cascade',
    })
  })

  it('author_id queda en NULL si se borra la cuenta del autor (SET NULL)', () => {
    expect(describeForeignKey('author_id')).toEqual({
      references: 'user',
      referencesColumn: 'id',
      onDelete: 'set null',
    })
    expect(column('author_id').notNull).toBe(false)
  })

  it('no tiene más FKs que esas dos — en particular, ninguna hacia guilds', () => {
    // Decisión: no se desnormaliza guild_id. Una FK hacia `guilds` añadiría
    // una arista al orden de bloqueos del borrado de guilds.
    expect(
      config.foreignKeys
        .map((fk) => getTableName(fk.reference().foreignTable))
        .sort(),
    ).toEqual(['quests', 'user'])
  })
})

describe('guild_quest_comments — columnas del cursor', () => {
  it('created_at y edited_at guardan milisegundos (precisión 3)', () => {
    // Con la precisión por defecto (6) el cursor que viaja como Date de JS
    // perdería los microsegundos y la comparación (created_at, id) < cursor
    // podría saltarse o repetir filas.
    expect(precisionOf('created_at')).toBe(3)
    expect(precisionOf('edited_at')).toBe(3)
    expect(column('created_at').notNull).toBe(true)
    expect(column('edited_at').notNull).toBe(false)
  })

  it('created_at toma clock_timestamp(), no now()', () => {
    // `now()` es el inicio de la transacción: un comentario que esperó el
    // bloqueo de la quest quedaría fechado antes que uno confirmado entre medias.
    const defaultSql = new PgDialect().sqlToQuery(
      column('created_at').default as SQL,
    ).sql
    expect(defaultSql).toBe('clock_timestamp()')
  })

  it('el índice del hilo recorre (quest_id, created_at, id) en ese orden', () => {
    const threadIndex = config.indexes.find(
      (candidate) =>
        candidate.config.name ===
        'guild_quest_comments_quest_id_created_at_id_idx',
    )

    expect(
      threadIndex?.config.columns.map(
        (indexColumn) => (indexColumn as { name: string }).name,
      ),
    ).toEqual(['quest_id', 'created_at', 'id'])
  })
})
