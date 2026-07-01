/**
 * Script one-off — procesa el pack "Free RPG Fantasy Avatar Icons" (CraftPix).
 *
 * Flujo:
 *  1. Escanea `assets-source/avatars/` de forma recursiva (layout desconocido).
 *  2. Conserva solo las imágenes cuadradas (width === height); descarta los
 *     retratos transparentes de dimensiones variables y cualquier archivo que
 *     no sea una imagen legible (readme, licencia, previews, etc.).
 *  3. Redimensiona cada imagen cuadrada a 128x128 y la convierte a WebP (q80),
 *     escribiéndola en `public/avatars/` con nombres secuenciales limpios.
 *  4. Genera un manifiesto tipado en `src/features/user/avatar-catalog.ts`.
 *
 * Uso: `npx tsx scripts/build-avatars.ts` (o `pnpm tsx ...`).
 * No toca la base de datos ni requiere el servidor de desarrollo.
 */
import { readdir, mkdir, writeFile, rm } from 'node:fs/promises'
import { join, extname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

import sharp from 'sharp'

// Rutas relativas a la raíz del proyecto (este archivo vive en scripts/)
const PROJECT_ROOT = fileURLToPath(new URL('..', import.meta.url))
const SOURCE_DIR = join(PROJECT_ROOT, 'assets-source', 'avatars')
const OUTPUT_DIR = join(PROJECT_ROOT, 'public', 'avatars')
const MANIFEST_PATH = join(
  PROJECT_ROOT,
  'src',
  'features',
  'user',
  'avatar-catalog.ts',
)

// Parámetros de salida
const OUTPUT_SIZE = 128
const WEBP_QUALITY = 80

// Rango esperado de personajes del pack (nominalmente 50)
const EXPECTED_COUNT = 50
const MIN_REASONABLE = 40
const MAX_REASONABLE = 60

// Extensiones candidatas a imagen; el filtro real es la lectura de metadata
const IMAGE_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.gif',
  '.bmp',
  '.tif',
  '.tiff',
  '.avif',
])

// Recolecta recursivamente todas las rutas de archivo bajo `dir`
async function collectFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  const files: string[] = []

  for (const entry of entries) {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(fullPath)))
    } else if (entry.isFile()) {
      files.push(fullPath)
    }
  }

  return files
}

// Orden natural: "2.png" antes que "10.png" (evita el orden lexicográfico)
function naturalCompare(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
}

// Padding del índice según la cantidad real (mínimo 2 dígitos: avatar-01)
function pad(index: number, total: number): string {
  const width = Math.max(2, String(total).length)
  return String(index).padStart(width, '0')
}

async function main() {
  console.log(`\n▶ Scanning ${relative(PROJECT_ROOT, SOURCE_DIR)} ...`)

  const allFiles = await collectFiles(SOURCE_DIR)
  const imageCandidates = allFiles.filter((file) =>
    IMAGE_EXTENSIONS.has(extname(file).toLowerCase()),
  )

  console.log(
    `  Found ${allFiles.length} file(s), ${imageCandidates.length} image candidate(s) by extension.`,
  )

  // Filtra quedándose solo con las imágenes cuadradas legibles
  const squareImages: string[] = []
  let skippedNonSquare = 0
  let skippedUnreadable = 0

  for (const file of imageCandidates) {
    let width: number | undefined
    let height: number | undefined
    try {
      const metadata = await sharp(file).metadata()
      width = metadata.width
      height = metadata.height
    } catch {
      // No es una imagen legible por sharp — se descarta silenciosamente
      skippedUnreadable += 1
      continue
    }

    if (!width || !height) {
      skippedUnreadable += 1
      continue
    }

    if (width === height) {
      squareImages.push(file)
    } else {
      skippedNonSquare += 1
    }
  }

  // Orden estable para que los índices secuenciales sean reproducibles
  squareImages.sort(naturalCompare)

  const count = squareImages.length
  console.log(
    `  Skipped ${skippedNonSquare} non-square, ${skippedUnreadable} unreadable/non-image.`,
  )
  console.log(`  Qualifying square images: ${count}`)

  // Advertencia si la cantidad se aleja de lo esperado (no se aborta)
  if (count < MIN_REASONABLE || count > MAX_REASONABLE) {
    console.warn(
      `\n⚠  WARNING: expected ~${EXPECTED_COUNT} square avatars (pack has 50 characters), ` +
        `but found ${count}. Discrepancy: ${count - EXPECTED_COUNT >= 0 ? '+' : ''}${
          count - EXPECTED_COUNT
        } vs ${EXPECTED_COUNT}.`,
    )
    console.warn(
      '   Review the source folder — the reasonable range is ' +
        `${MIN_REASONABLE}–${MAX_REASONABLE}.\n`,
    )
  }

  if (count === 0) {
    throw new Error(
      'No square images found — nothing to process. Aborting before wiping output.',
    )
  }

  // Regenera el directorio de salida desde cero para evitar sobrantes
  await rm(OUTPUT_DIR, { recursive: true, force: true })
  await mkdir(OUTPUT_DIR, { recursive: true })

  // Procesa cada imagen y arma las entradas del manifiesto
  const catalog: { id: string; src: string }[] = []

  for (let i = 0; i < count; i += 1) {
    const sourceFile = squareImages[i]
    const id = `avatar-${pad(i + 1, count)}`
    const fileName = `${id}.webp`
    const outputFile = join(OUTPUT_DIR, fileName)

    await sharp(sourceFile)
      .resize(OUTPUT_SIZE, OUTPUT_SIZE, { fit: 'cover' })
      .webp({ quality: WEBP_QUALITY })
      .toFile(outputFile)

    catalog.push({ id, src: `/avatars/${fileName}` })
  }

  console.log(
    `  Wrote ${catalog.length} WebP file(s) to ${relative(PROJECT_ROOT, OUTPUT_DIR)}.`,
  )

  // Genera el manifiesto tipado (archivo auto-generado; no editar a mano)
  const manifest = `/**
 * Catálogo de avatares estáticos — AUTO-GENERADO por scripts/build-avatars.ts.
 * No editar a mano: correr el script para regenerarlo.
 *
 * Cada entrada referencia una imagen WebP de 128x128 servida desde public/avatars.
 * El campo \`id\` es el valor persistido en \`user.avatarId\`.
 */

export type AvatarCatalogEntry = {
  id: string
  src: string
}

export const avatarCatalog: AvatarCatalogEntry[] = [
${catalog.map((entry) => `  { id: '${entry.id}', src: '${entry.src}' },`).join('\n')}
]

// Índice id -> src para resolver rápidamente el avatar elegido por el usuario
const avatarSrcById = new Map(avatarCatalog.map((a) => [a.id, a.src]))

/** Conjunto de ids válidos, reutilizable por la validación del servidor. */
export const avatarIds = avatarCatalog.map((a) => a.id)

/**
 * Devuelve la ruta pública del avatar con \`id\`, o \`null\` si el id no existe
 * (incluye el caso \`null\`/\`undefined\` de un usuario sin avatar elegido).
 */
export function getAvatarSrc(id: string | null | undefined): string | null {
  if (!id) return null
  return avatarSrcById.get(id) ?? null
}
`

  await writeFile(MANIFEST_PATH, manifest, 'utf8')
  console.log(
    `  Generated manifest at ${relative(PROJECT_ROOT, MANIFEST_PATH)}.`,
  )

  console.log(`\n✔ Done — ${catalog.length} avatars processed.\n`)
}

main().catch((error) => {
  console.error('\nx build-avatars failed:', error)
  process.exitCode = 1
})
