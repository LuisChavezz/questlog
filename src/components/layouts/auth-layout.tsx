import { Outlet } from '@tanstack/react-router'

// Layout sin sidebar para las páginas de autenticación
export function AuthLayout() {
  return (
    <div className="relative min-h-dvh flex items-center justify-center overflow-hidden">
      {/* Orb flotante principal: lagoon */}
      <div
        className="pointer-events-none absolute left-[10%] top-[-15%] w-[70vw] h-[70vw] rounded-full blur-[180px] opacity-[0.18] dark:opacity-[0.12] bg-(--lagoon) animate-[auth-float_12s_ease-in-out_infinite]"
        aria-hidden="true"
      />
      {/* Orb flotante secundario: palm */}
      <div
        className="pointer-events-none absolute right-[-10%] bottom-[-10%] w-[55vw] h-[55vw] rounded-full blur-[160px] opacity-[0.13] dark:opacity-[0.09] bg-(--palm) animate-[auth-float_16s_ease-in-out_infinite_5s]"
        aria-hidden="true"
      />
      {/* Orb pequeño: lagoon-deep */}
      <div
        className="pointer-events-none absolute right-[20%] top-[40%] w-[28vw] h-[28vw] rounded-full blur-[100px] opacity-[0.10] dark:opacity-[0.08] bg-(--lagoon-deep) animate-[auth-float_9s_ease-in-out_infinite_2s]"
        aria-hidden="true"
      />

      {/* Contenido centrado */}
      <div className="relative z-10 w-full max-w-md px-4 py-14">
        <Outlet />
      </div>
    </div>
  )
}
