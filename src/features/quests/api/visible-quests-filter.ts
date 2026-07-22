// Filtro compartido del conjunto de quests que ve un usuario en su lista
// personal (`/quests`): sus quests personales (sin guild) MÁS las quests de
// guild donde es creador o supervisor — no todas las del guild.
//
// En el tramo de guild se exige además pertenencia VIGENTE: expulsar a un
// miembro limpia sus asignaciones (assignee/supervisor) pero NO su autoría, así
// que sin esta condición un expulsado seguiría viendo en su lista personal
// quests de un guild al que ya no pertenece — y sobre las que el servidor le
// rechazaría cualquier edición. Esa misma pertenencia es la que garantiza que el
// cliente siempre pueda resolver el nombre del guild para agrupar las filas, ya
// que `getGuilds` devuelve exactamente los guilds de los que es miembro.
//
// Vive en su propio módulo porque `get-quests` y `get-quest-guilds` deben
// describir EXACTAMENTE el mismo conjunto de filas: si divergen, la lista
// personal pintaría quests sin sección de guild donde vivir, o secciones de
// guild sin quests que mostrar.
import { and, eq, exists, isNotNull, isNull, or, sql } from 'drizzle-orm'

import { db } from '#/db'
import { guildMembers, quests } from '#/db/schema'

// El rol que hace visible una quest de guild en la lista personal: ser su
// creador o su supervisor. Separado de `buildVisibleQuestsFilter` para que
// `getQuestGuilds` pueda aplicar SOLO este criterio cuando su propia query ya
// estableció lo demás (membresía vigente vía su JOIN, y guildId no nulo al
// estar fijado al guild del row exterior) — un único lugar define el rol, sin
// re-evaluar condiciones ya garantizadas.
export function buildGuildQuestRoleFilter(userId: string) {
  return or(eq(quests.ownerId, userId), eq(quests.supervisorId, userId))
}

export function buildVisibleQuestsFilter(userId: string) {
  return or(
    // Personales: propias y sin guild
    and(eq(quests.ownerId, userId), isNull(quests.guildId)),
    // De guild: creador o supervisor, y miembro vigente del guild
    and(
      isNotNull(quests.guildId),
      buildGuildQuestRoleFilter(userId),
      exists(
        db
          .select({ one: sql`1` })
          .from(guildMembers)
          .where(
            and(
              eq(guildMembers.guildId, quests.guildId),
              eq(guildMembers.userId, userId),
            ),
          ),
      ),
    ),
  )
}
