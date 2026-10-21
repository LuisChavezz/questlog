import {
  HeadContent,
  Scripts,
  createRootRouteWithContext,
} from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'

import TanStackQueryDevtools from '../integrations/tanstack-query/devtools'
import { ThemeProvider } from '../components/providers/theme-provider'
import { NotFoundPage } from '#/components/not-found-page'

import appCss from '../styles.css?url'
// Mismo archivo que referencia `opsz.css` para el subset latin normal: Vite lo
// emite una sola vez con el mismo hash, así que el preload y el @font-face
// apuntan a la misma URL.
import newsreaderLatinWoff2 from '@fontsource-variable/newsreader/files/newsreader-latin-opsz-normal.woff2?url'

import type { QueryClient } from '@tanstack/react-query'

interface MyRouterContext {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'Questlog',
      },
    ],
    links: [
      // Preload de la tipografía por defecto (solo el subset latin normal): sin
      // él, el navegador la descubre tras parsear el CSS y el texto cambia de
      // la fuente de respaldo a Newsreader con un salto de layout.
      {
        rel: 'preload',
        href: newsreaderLatinWoff2,
        as: 'font',
        type: 'font/woff2',
        crossOrigin: 'anonymous',
      },
      {
        rel: 'stylesheet',
        href: appCss,
      },
    ],
  }),
  shellComponent: RootDocument,
  notFoundComponent: NotFoundPage,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <HeadContent />
        {/*
         * Script anti-FOUC: lee localStorage antes del primer render
         * para aplicar la clase 'dark' sin parpadeo visible.
         */}
        {/*
         * Script anti-FOUC: parsea el JSON que almacena Zustand persist
         * para aplicar la clase 'dark' antes del primer render.
         */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var s=localStorage.getItem('questlog-theme');if(s){var p=JSON.parse(s);if(p&&p.state&&p.state.theme==='dark')document.documentElement.classList.add('dark');}}catch(e){}})()`,
          }}
        />
      </head>
      <body>
        <ThemeProvider>
          {children}
        </ThemeProvider>
        <TanStackDevtools
          config={{
            position: 'bottom-right',
          }}
          plugins={[
            {
              name: 'Tanstack Router',
              render: <TanStackRouterDevtoolsPanel />,
            },
            TanStackQueryDevtools,
          ]}
        />
        <Scripts />
      </body>
    </html>
  )
}
