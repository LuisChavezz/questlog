// @vitest-environment jsdom
// Regresión del bug: al limpiar un avatar del catálogo (avatarId -> null) el
// avatar quedaba en blanco (y el botón del header "desaparecía") hasta recargar.
//
// Causa raíz: Radix `Avatar` guarda el `imageLoadingStatus` en el Root. Cuando
// `UserAvatar` montaba `<AvatarImage>` con `{src && …}`, quitar la imagen la
// DESMONTABA sin resetear ese estado, que se quedaba en "loaded"; el
// `AvatarFallback` solo se pinta cuando el estado NO es "loaded", así que las
// iniciales quedaban ocultas. La solución es montar SIEMPRE `<AvatarImage>` para
// que Radix mueva el estado a "error" al desaparecer `src` y muestre el fallback.
//
// jsdom no carga imágenes reales, así que sustituimos `window.Image` por un
// mock que reporta "cargada" en cuanto se le asigna un `src` no vacío — es la
// única forma de reproducir el estado "loaded" del que depende el bug.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

import { UserAvatar } from './user-avatar'

// Imagen falsa: asignar un `src` no vacío la marca como cargada de inmediato
// (complete + naturalWidth), que es lo que Radix consulta para el estado.
class MockImage {
  private _src = ''
  private loadListeners: Array<() => void> = []
  complete = false
  naturalWidth = 0
  referrerPolicy = ''
  crossOrigin: string | null = null

  get src() {
    return this._src
  }

  set src(value: string) {
    this._src = value
    if (value) {
      this.complete = true
      this.naturalWidth = 1
      this.loadListeners.forEach((fn) => fn())
    } else {
      this.complete = false
      this.naturalWidth = 0
    }
  }

  addEventListener(type: string, handler: () => void) {
    // Solo nos interesa el evento 'load'; el de 'error' nunca se dispara aquí.
    if (type === 'load') this.loadListeners.push(handler)
  }

  removeEventListener(type: string, handler: () => void) {
    if (type === 'load') {
      this.loadListeners = this.loadListeners.filter((fn) => fn !== handler)
    }
  }
}

describe('UserAvatar', () => {
  beforeEach(() => {
    vi.stubGlobal('Image', MockImage)
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('vuelve a las iniciales al limpiar un avatar del catálogo (avatarId -> null)', () => {
    const { rerender } = render(
      <UserAvatar
        name="Ada Lovelace"
        email="ada@questlog.dev"
        avatarId="avatar-01"
      />,
    )

    // Con avatar: se pinta la <img> del catálogo y el fallback queda oculto.
    const image = screen.getByRole('img')
    expect(image.getAttribute('src')).toBe('/avatars/avatar-01.webp')
    expect(screen.queryByText('AL')).toBeNull()

    // Al limpiar el avatar, el fallback de iniciales debe reaparecer al instante
    // (sin recargar) y la imagen desaparecer.
    rerender(
      <UserAvatar
        name="Ada Lovelace"
        email="ada@questlog.dev"
        avatarId={null}
      />,
    )

    expect(screen.queryByText('AL')).not.toBeNull()
    expect(screen.queryByRole('img')).toBeNull()
  })

  it('muestra iniciales cuando nunca hubo avatar ni imagen', () => {
    render(
      <UserAvatar
        name="Ada Lovelace"
        email="ada@questlog.dev"
        avatarId={null}
      />,
    )

    expect(screen.queryByText('AL')).not.toBeNull()
    expect(screen.queryByRole('img')).toBeNull()
  })
})
