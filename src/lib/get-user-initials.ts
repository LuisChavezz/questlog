// Utilidad para obtener iniciales legibles a partir del nombre o email.
export function getUserInitials(
  name?: string | null,
  email?: string | null,
): string {
  const normalizedName = name?.trim()

  if (normalizedName) {
    const parts = normalizedName.split(/\s+/).filter(Boolean)

    if (parts.length >= 2) {
      return `${parts[0]?.[0] ?? ''}${parts[1]?.[0] ?? ''}`.toUpperCase()
    }

    return normalizedName.slice(0, 2).toUpperCase()
  }

  const normalizedEmail = email?.trim()

  if (normalizedEmail) {
    return normalizedEmail.slice(0, 2).toUpperCase()
  }

  return 'U'
}