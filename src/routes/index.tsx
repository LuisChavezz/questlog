import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-lg font-medium">Hola Mundo</p>
    </div>
  )
}
