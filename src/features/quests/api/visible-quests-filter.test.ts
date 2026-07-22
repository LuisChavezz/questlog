// @vitest-environment node
// Tests del filtro compartido de visibilidad: `drizzle-stub` (usado por los
// tests de handlers) ignora el argumento de `.where()` por completo, así que
// no sirve para vigilar la condición SQL en sí. Aquí se compila la condición
// con `PgDialect` (sin conexión real) y se inspecciona el SQL resultante, que
// es la única forma de fijar por regresión el rol exacto que exige el filtro.
import { describe, expect, it } from 'vitest'
import { PgDialect } from 'drizzle-orm/pg-core'

import {
  buildGuildQuestRoleFilter,
  buildVisibleQuestsFilter,
} from './visible-quests-filter'

const dialect = new PgDialect()

describe('buildGuildQuestRoleFilter', () => {
  it('incluye al asignado junto a creador y supervisor', () => {
    const { sql } = dialect.sqlToQuery(buildGuildQuestRoleFilter('user-1')!)

    // Un Member sin autoría ni supervisión debe quedar cubierto por ser
    // asignado — si esta columna faltara, ese caso volvería a quedar fuera.
    expect(sql).toContain('"quests"."owner_id"')
    expect(sql).toContain('"quests"."supervisor_id"')
    expect(sql).toContain('"quests"."assignee_id"')
  })
})

describe('buildVisibleQuestsFilter', () => {
  it('el tramo de guild exige rol (con asignado) Y membresía vigente', () => {
    const { sql } = dialect.sqlToQuery(buildVisibleQuestsFilter('user-1')!)

    expect(sql).toContain('"quests"."assignee_id"')
    // La condición de membresía vigente (exists sobre guild_members) debe
    // seguir presente: expandir el rol no debe destaparla para un expulsado.
    expect(sql).toContain('exists')
    expect(sql).toContain('"guild_members"')
  })
})
