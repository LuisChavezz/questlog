// @vitest-environment node
// Prueba de humo de sharp, cuyo único consumidor es scripts/build-avatars.ts.
// Ni el build ni el resto de la suite cargan sharp, así que sin este test un
// binario nativo que no carga o un encoder WebP roto tras actualizar sharp
// pasarían todos los checks. Reproduce la misma cadena que el script
// (resize 128x128 con `fit: 'cover'` + WebP q80) sobre una imagen generada en
// memoria, para no versionar ningún fixture binario.
import sharp from 'sharp'
import { describe, expect, it } from 'vitest'

describe('sharp (build-avatars)', () => {
  it('redimensiona a 128x128 y codifica en WebP como el script', async () => {
    // Fuente rectangular para que `fit: 'cover'` tenga que recortar
    const source = await sharp({
      create: {
        width: 300,
        height: 200,
        channels: 3,
        background: { r: 120, g: 80, b: 200 },
      },
    })
      .png()
      .toBuffer()

    const output = await sharp(source)
      .resize(128, 128, { fit: 'cover' })
      .webp({ quality: 80 })
      .toBuffer()

    const metadata = await sharp(output).metadata()
    expect(metadata.format).toBe('webp')
    expect(metadata.width).toBe(128)
    expect(metadata.height).toBe(128)
  })
})
