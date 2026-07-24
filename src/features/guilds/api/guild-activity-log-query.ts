// Consulta y forma de la bitácora de actividad de un guild. Aísla el JOIN (log ⋈
// quest para el título ⋈ user para el actor) y el mapeo de cada fila a su forma
// de presentación, para que la tarjeta "Recent Activity" y el modal de historial
// compartan EXACTAMENTE la misma consulta y el mismo shaping — sin N+1 y sin que
// puedan divergir en columnas o en cómo resuelven el actor.
import { count, desc, eq } from 'drizzle-orm'

import { db } from '#/db'
import { guildQuestActivityLog, quests, user } from '#/db/schema'
import type {
  GuildQuestActivityEventType,
  GuildQuestActivityField,
} from '#/db/schema'
import { getUserInitials } from '#/lib/get-user-initials'

// Tamaño de página fijo del historial paginado (modal "View all"). 20 filas por
// carga: suficiente para llenar el modal sin traer de más en cada "Load more".
export const GUILD_ACTIVITY_PAGE_SIZE = 20

// Ejecutor de las consultas: el `db` global por defecto, o una transacción
// activa. El historial paginado pasa su `tx` para leer la página y el total en
// el MISMO snapshot, de modo que una inserción concurrente entre ambas no pueda
// descuadrar `total`/`hasMore` respecto a las filas devueltas. Se deriva del
// propio `db` para no acoplar el módulo al driver, igual que `GuildQuestAuthTx`.
type ActivityLogExecutor =
  | typeof db
  | Parameters<Parameters<typeof db.transaction>[0]>[0]

// Actor de un evento, ya resuelto a datos de presentación (nombre + avatar +
// iniciales de respaldo). `null` cuando el actor no se conoce — su cuenta se
// borró y el FK quedó en NULL (ON DELETE SET NULL).
export interface GuildActivityLogActor {
  userId: string
  name: string | null
  image: string | null
  avatarId: string | null
  initials: string
}

// Una entrada de la bitácora lista para renderizar: metadatos del evento + el
// título de la quest (para enlazar al drawer) + el actor resuelto.
export interface GuildActivityLogEntry {
  id: string
  questId: string
  questTitle: string
  eventType: GuildQuestActivityEventType
  field: GuildQuestActivityField | null
  oldValue: string | null
  newValue: string | null
  createdAt: Date
  actor: GuildActivityLogActor | null
}

// Límite y offset de una página (0-based) del historial. Función pura para poder
// testear los límites de paginación sin tocar la BD.
export function getGuildActivityPageBounds(page: number) {
  return {
    limit: GUILD_ACTIVITY_PAGE_SIZE,
    offset: page * GUILD_ACTIVITY_PAGE_SIZE,
  }
}

// ¿Quedan más filas tras la página ya cargada? Pura: `offset` de la página +
// cuántas trajo, comparado con el total. En el límite exacto (offset + count ===
// total) NO quedan más.
export function hasMoreActivity(
  offset: number,
  itemCount: number,
  total: number,
) {
  return offset + itemCount < total
}

// Mapea una fila del JOIN a su forma de presentación. El email del actor solo se
// selecciona para derivar las iniciales de respaldo y NO se propaga al cliente
// (mismo criterio que `toMemberWithInitials`).
function toActivityLogEntry(row: {
  id: string
  questId: string
  questTitle: string
  eventType: GuildQuestActivityEventType
  field: GuildQuestActivityField | null
  oldValue: string | null
  newValue: string | null
  createdAt: Date
  actorId: string | null
  actorName: string | null
  actorEmail: string | null
  actorImage: string | null
  actorAvatarId: string | null
}): GuildActivityLogEntry {
  return {
    id: row.id,
    questId: row.questId,
    questTitle: row.questTitle,
    eventType: row.eventType,
    field: row.field,
    oldValue: row.oldValue,
    newValue: row.newValue,
    createdAt: row.createdAt,
    // Solo hay actor si el FK sigue apuntando a un usuario; el LEFT JOIN deja
    // sus columnas en NULL cuando `actorId` es NULL.
    actor: row.actorId
      ? {
          userId: row.actorId,
          name: row.actorName,
          image: row.actorImage,
          avatarId: row.actorAvatarId,
          initials: getUserInitials(row.actorName, row.actorEmail),
        }
      : null,
  }
}

// Trae las entradas de la bitácora de un guild, más recientes primero, en UNA
// sola consulta con los JOINs necesarios. `innerJoin` a quests porque el FK
// (NOT NULL, ON DELETE CASCADE) garantiza que la quest existe; `leftJoin` a user
// porque el actor puede ser NULL.
export async function queryGuildActivityLog(
  guildId: string,
  opts: { limit: number; offset?: number },
  executor: ActivityLogExecutor = db,
): Promise<GuildActivityLogEntry[]> {
  const query = executor
    .select({
      id: guildQuestActivityLog.id,
      questId: guildQuestActivityLog.questId,
      questTitle: quests.title,
      eventType: guildQuestActivityLog.eventType,
      field: guildQuestActivityLog.field,
      oldValue: guildQuestActivityLog.oldValue,
      newValue: guildQuestActivityLog.newValue,
      createdAt: guildQuestActivityLog.createdAt,
      actorId: guildQuestActivityLog.actorId,
      actorName: user.name,
      actorEmail: user.email,
      actorImage: user.image,
      actorAvatarId: user.avatarId,
    })
    .from(guildQuestActivityLog)
    .innerJoin(quests, eq(guildQuestActivityLog.questId, quests.id))
    .leftJoin(user, eq(guildQuestActivityLog.actorId, user.id))
    .where(eq(guildQuestActivityLog.guildId, guildId))
    // Orden estable: createdAt DESC como criterio principal y el id (UUID único)
    // como desempate. Sin el desempate, las filas que un update multi-campo
    // inserta en la MISMA transacción comparten `created_at` (defaultNow se
    // resuelve una vez por statement) y Postgres deja su orden relativo
    // indefinido — lo que en la paginación por offset del historial puede
    // saltarse o duplicar filas en el límite entre páginas.
    .orderBy(
      desc(guildQuestActivityLog.createdAt),
      desc(guildQuestActivityLog.id),
    )
    .limit(opts.limit)
    .offset(opts.offset ?? 0)

  const rows = await query

  return rows.map(toActivityLogEntry)
}

// Total de filas de bitácora de un guild — para calcular `hasMore` en el
// historial paginado.
export async function countGuildActivityLog(
  guildId: string,
  executor: ActivityLogExecutor = db,
): Promise<number> {
  const [row] = await executor
    .select({ total: count() })
    .from(guildQuestActivityLog)
    .where(eq(guildQuestActivityLog.guildId, guildId))

  return row.total
}
