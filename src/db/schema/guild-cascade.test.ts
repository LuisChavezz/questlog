// @vitest-environment node
// Fija la cadena de cascadas de la que depende el borrado de un guild.
// `deleteGuildHandler` emite UNA sola escritura (`DELETE FROM guilds`) y confía
// en las claves foráneas para arrastrar el resto; sin estas aserciones, cambiar
// un `onDelete` en el esquema convertiría ese borrado en huérfanos silenciosos
// (quests de un guild inexistente) sin que ningún test se enterase.
//
// Cadena esperada al borrar una fila de `guilds`:
//   guilds → guild_members            (guild_id CASCADE)
//   guilds → quests                   (guild_id CASCADE)
//   guilds → guild_quest_activity_log (guild_id CASCADE)
//   quests → guild_quest_activity_log (quest_id CASCADE)  [transitiva]
import { describe, expect, it } from 'vitest'
import { getTableName, is } from 'drizzle-orm'
import { getTableConfig, PgTable } from 'drizzle-orm/pg-core'

import * as schema from '#/db/schema'
import { guildQuestActivityLog, guildMembers, quests } from '#/db/schema'

// Devuelve la FK de `table` cuya columna origen es `columnName`.
function foreignKeyOn(table: PgTable, columnName: string) {
  return getTableConfig(table).foreignKeys.find((fk) =>
    fk.reference().columns.some((column) => column.name === columnName),
  )
}

// Describe una FK como { hacia, columna destino, acción } para comparar de un
// vistazo, en vez de encadenar aserciones sueltas sobre el objeto de Drizzle.
function describeForeignKey(table: PgTable, columnName: string) {
  const fk = foreignKeyOn(table, columnName)
  if (!fk) return null

  const reference = fk.reference()
  return {
    references: getTableName(reference.foreignTable),
    referencesColumn: reference.foreignColumns[0]?.name,
    onDelete: fk.onDelete,
  }
}

describe('cascadas al borrar un guild', () => {
  it('quests.guild_id cae con el guild (CASCADE, no set null)', () => {
    // El cambio deliberado de esta feature: borrar un guild borra sus quests en
    // vez de reconvertirlas en quests personales de su creador.
    expect(describeForeignKey(quests, 'guild_id')).toEqual({
      references: 'guilds',
      referencesColumn: 'id',
      onDelete: 'cascade',
    })
  })

  it('guild_members.guild_id cae con el guild (CASCADE)', () => {
    expect(describeForeignKey(guildMembers, 'guild_id')).toEqual({
      references: 'guilds',
      referencesColumn: 'id',
      onDelete: 'cascade',
    })
  })

  it('guild_quest_activity_log.guild_id cae con el guild (CASCADE)', () => {
    expect(describeForeignKey(guildQuestActivityLog, 'guild_id')).toEqual({
      references: 'guilds',
      referencesColumn: 'id',
      onDelete: 'cascade',
    })
  })

  it('guild_quest_activity_log.quest_id cae con la quest (CASCADE transitiva)', () => {
    // Rama transitiva: el guild borra sus quests y cada quest se lleva su propia
    // bitácora. Es lo que hace que borrar un guild borre también el historial.
    expect(describeForeignKey(guildQuestActivityLog, 'quest_id')).toEqual({
      references: 'quests',
      referencesColumn: 'id',
      onDelete: 'cascade',
    })
  })

  it('no hay ninguna otra tabla apuntando a guilds fuera de esa cadena', () => {
    // Guard de completitud: si mañana una tabla nueva referencia `guilds`, este
    // test falla y obliga a decidir explícitamente su `onDelete` (y a
    // documentarlo en la cadena) en vez de dejar que el borrado la ignore o
    // falle en runtime por una FK que restringe.
    // El barril exporta tablas, enums, relaciones y tipos mezclados: se pasa por
    // `unknown` para quedarse solo con las tablas vía el guard de Drizzle, sin
    // que el tipo unión de los demás exports contamine el predicado.
    const tables = Object.values(schema as Record<string, unknown>).filter(
      (value): value is PgTable => is(value, PgTable),
    )

    const referencesToGuilds = tables.flatMap((table) =>
      getTableConfig(table)
        .foreignKeys.filter(
          (fk) => getTableName(fk.reference().foreignTable) === 'guilds',
        )
        .map((fk) => ({
          from: `${getTableName(table)}.${fk.reference().columns[0]?.name}`,
          onDelete: fk.onDelete,
        })),
    )

    expect(
      referencesToGuilds.sort((a, b) => a.from.localeCompare(b.from)),
    ).toEqual([
      { from: 'guild_members.guild_id', onDelete: 'cascade' },
      { from: 'guild_quest_activity_log.guild_id', onDelete: 'cascade' },
      { from: 'quests.guild_id', onDelete: 'cascade' },
    ])
  })
})
