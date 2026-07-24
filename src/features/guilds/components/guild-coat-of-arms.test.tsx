// @vitest-environment jsdom
// Regresión: si el <img> del escudo fallaba al cargar, `failed` quedaba en
// `true` para siempre — al regenerar el escudo (svg prop -> uno nuevo válido)
// el componente seguía mostrando el ícono genérico de respaldo en vez de
// reintentar con el SVG nuevo. La causa era que `failed` nunca se reseteaba;
// la solución es un `useEffect` que lo limpia cada vez que cambia `svg`.
import { describe, expect, it } from 'vitest'
import { fireEvent, render } from '@testing-library/react'

import { GuildCoatOfArms } from './guild-coat-of-arms'

describe('GuildCoatOfArms', () => {
  it('reintenta con un svg nuevo tras un fallo de carga previo', () => {
    const { container, rerender } = render(
      <GuildCoatOfArms svg="<svg>old</svg>" />,
    )

    // Carga inicial: se intenta el <img>, no el fallback
    expect(container.querySelector('img')).not.toBeNull()
    expect(container.querySelector('svg')).toBeNull()

    // Falla la carga de la imagen -> cae al ícono genérico (GuildEmblem)
    const image = container.querySelector('img')
    if (!image) throw new Error('expected <img> to be rendered')
    fireEvent.error(image)

    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('svg')).not.toBeNull()

    // Regenerar el escudo (svg prop cambia a uno nuevo válido) debe limpiar
    // el estado de fallo y volver a intentar con el <img>, no quedar pegado
    // en el fallback.
    rerender(<GuildCoatOfArms svg="<svg>new</svg>" />)

    expect(container.querySelector('img')).not.toBeNull()
    expect(container.querySelector('svg')).toBeNull()
  })
})
