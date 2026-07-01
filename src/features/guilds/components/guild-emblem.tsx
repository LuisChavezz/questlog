// Ilustración SVG con temática de gremio RPG (escudo con espadas cruzadas).
// Compartida por el estado vacío de guilds y la pantalla de invitación.
type GuildEmblemProps = {
  className?: string
}

export function GuildEmblem({
  className = 'h-24 w-24 text-primary',
}: GuildEmblemProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 96 96"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      {/* Escudo: forma heráldica clásica con parte superior plana y punta inferior */}
      <path
        d="M16 12 H80 V48 Q80 74 48 88 Q16 74 16 48 Z"
        fill="currentColor"
        fillOpacity="0.08"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* Marco interior decorativo del escudo */}
      <path
        d="M22 18 H74 V48 Q74 68 48 82 Q22 68 22 48 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeOpacity="0.3"
        strokeLinejoin="round"
      />
      {/* Espada izquierda — hoja diagonal de abajo-izquierda a arriba-derecha */}
      <line
        x1="30"
        y1="70"
        x2="66"
        y2="30"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* Espada izquierda — guardia cruzada */}
      <line
        x1="25"
        y1="65"
        x2="35"
        y2="75"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeOpacity="0.6"
      />
      {/* Espada izquierda — pomo */}
      <circle cx="27" cy="73" r="2.5" fill="currentColor" fillOpacity="0.45" />
      {/* Espada derecha — hoja diagonal de abajo-derecha a arriba-izquierda */}
      <line
        x1="66"
        y1="70"
        x2="30"
        y2="30"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* Espada derecha — guardia cruzada */}
      <line
        x1="61"
        y1="75"
        x2="71"
        y2="65"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeOpacity="0.6"
      />
      {/* Espada derecha — pomo */}
      <circle cx="69" cy="73" r="2.5" fill="currentColor" fillOpacity="0.45" />
    </svg>
  )
}
