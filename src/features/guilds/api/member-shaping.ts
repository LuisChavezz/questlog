// Único punto donde una fila de miembro (guild_members ⋈ user) que trae
// `email` se prepara para salir hacia el cliente: deriva las iniciales de
// respaldo del avatar Y retira el email en el mismo paso. El email solo se
// selecciona para alimentar esas iniciales y NUNCA debe llegar al payload —
// centralizar el "quitar email + derivar iniciales" aquí evita que una futura
// consulta copie el patrón a mano y olvide el retiro (con un spread `...row`,
// el email se filtraría en silencio).
import { getUserInitials } from '#/lib/get-user-initials'

export function toMemberWithInitials<
  TRow extends { name?: string | null; email?: string | null },
>({ email, ...member }: TRow): Omit<TRow, 'email'> & { initials: string } {
  return { ...member, initials: getUserInitials(member.name, email) }
}
