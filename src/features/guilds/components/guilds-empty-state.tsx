import { Button } from '#/components/ui/button'

// Ilustración SVG con temática de gremio RPG (escudo con espadas cruzadas)
function GuildEmblem() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 96 96"
      fill="none"
      className="h-24 w-24 text-primary"
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

type GuildsEmptyStateProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function GuildsEmptyState({ open, onOpenChange }: GuildsEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-6 py-24 text-center">
      <div className="rounded-2xl bg-primary/5 p-6">
        <GuildEmblem />
      </div>
      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold text-foreground">No guilds yet</h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          Create a guild to start collaborating with your team on quests.
        </p>
      </div>
      <Button onClick={() => onOpenChange(true)}>Create Guild</Button>
    </div>
  )
}
