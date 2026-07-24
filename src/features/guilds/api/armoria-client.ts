// Cliente de la Armoria API (heráldica procedural, Azgaar/armoria-api).
// Se invoca UNA sola vez, al crear el guild — el SVG resultante se persiste
// en `coatOfArmsSvg` y la app nunca vuelve a depender de este servicio
// externo después. El README del proyecto advierte que el seed no debe
// usarse como método de almacenamiento permanente y que está pensado para
// pruebas, no para producción sin contactar al mantenedor — por eso no se
// resuelve el escudo "en vivo" en cada render.
const ARMORIA_BASE_URL = 'https://armoria.herokuapp.com'
const ARMORIA_TIMEOUT_MS = 5000
const ARMORIA_EMBLEM_SIZE = 256

// Genera el SVG de un escudo de armas a partir de un seed determinístico.
// Devuelve `null` ante cualquier fallo (red, timeout, respuesta no-200) — el
// llamador debe tratar la ausencia de escudo como un caso normal (fallback al
// ícono genérico), no como un error que deba propagarse.
export async function generateCoatOfArmsSvg(
  seed: string,
): Promise<string | null> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), ARMORIA_TIMEOUT_MS)

  try {
    const url = `${ARMORIA_BASE_URL}/?format=svg&size=${ARMORIA_EMBLEM_SIZE}&seed=${encodeURIComponent(seed)}`
    const response = await fetch(url, { signal: controller.signal })

    if (!response.ok) return null

    const svg = await response.text()
    return svg.length > 0 ? svg : null
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}
