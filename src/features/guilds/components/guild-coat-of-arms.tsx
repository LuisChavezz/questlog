import { useEffect, useState } from 'react'

import { GuildEmblem } from './guild-emblem'

type GuildCoatOfArmsProps = {
  // SVG persistido en `guilds.coat_of_arms_svg` (generado una sola vez al
  // crear el guild vía la Armoria API) — `null`/`undefined` si la generación
  // falló o el guild se creó antes de esta feature.
  svg: string | null | undefined
  className?: string
  // Clase aplicada al ícono genérico de respaldo (GuildEmblem)
  emblemClassName?: string
}

// Escudo de armas específico de un guild. Se renderiza como <img> con data
// URL en vez de inyectar el SVG como HTML vivo (dangerouslySetInnerHTML) —
// aunque el contenido lo genera nuestro propio servidor, sigue siendo la
// respuesta de un servicio de terceros, así que nunca se ejecuta como markup.
// Sin `svg` (o si la imagen falla al cargar), cae al ícono genérico.
export function GuildCoatOfArms({
  svg,
  className,
  emblemClassName,
}: GuildCoatOfArmsProps) {
  const [failed, setFailed] = useState(false)

  // Un nuevo `svg` (p. ej. tras "Regenerate") merece su propio intento de
  // carga — si no se resetea acá, un fallo con el SVG anterior deja el
  // fallback pegado para siempre, incluso con un SVG nuevo y válido.
  useEffect(() => {
    setFailed(false)
  }, [svg])

  if (!svg || failed) return <GuildEmblem className={emblemClassName} />

  return (
    <img
      src={`data:image/svg+xml,${encodeURIComponent(svg)}`}
      alt=""
      aria-hidden="true"
      className={className}
      onError={() => setFailed(true)}
    />
  )
}
