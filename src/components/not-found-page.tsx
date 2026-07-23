import { Link, useRouter } from '@tanstack/react-router'
import { Compass } from 'lucide-react'

import { Button } from '#/components/ui/button'

export function NotFoundPage() {
  const router = useRouter()

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 px-4 text-center">
      <Compass className="size-12 text-muted-foreground" />
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-foreground">
          Page not found
        </h1>
        <p className="text-muted-foreground">
          This quest doesn't exist, or you've wandered off the map.
        </p>
      </div>
      <div className="flex items-center gap-3">
        <Button variant="outline" onClick={() => router.history.back()}>
          Go back
        </Button>
        <Button asChild>
          <Link to="/quests">Back to Quests</Link>
        </Button>
      </div>
    </div>
  )
}
