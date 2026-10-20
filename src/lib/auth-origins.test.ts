// @vitest-environment node
// Fija la política de orígenes de Better Auth por entorno. `trustedOrigins`
// decide desde qué orígenes se puede iniciar sesión (Better Auth valida
// Origin/Referer incluso sin cookies), así que ensancharla por error, o dejar
// que producción caiga en localhost, debe romper un test y no pasar en silencio.
import { describe, expect, it } from 'vitest'

import { PRODUCTION_ORIGINS, resolveAuthOrigins } from './auth-origins'

const SCOPE = 'luis-alberto-ceja-chavezs-projects'
const PREVIEW_URL = `questlog-abc123xyz-${SCOPE}.vercel.app`
const PREVIEW_BRANCH_URL = `questlog-git-feature-${SCOPE}.vercel.app`
// Host con la forma de un preview del proyecto pero de otra cuenta de Vercel
const FOREIGN_ORIGIN = `https://questlog-git-x-${SCOPE}.vercel.app`

describe('resolveAuthOrigins', () => {
  describe('development', () => {
    it('usa localhost:3000 sin BETTER_AUTH_URL y no añade orígenes', () => {
      expect(resolveAuthOrigins({ NODE_ENV: 'development' })).toEqual({
        baseURL: 'http://localhost:3000',
        trustedOrigins: [],
      })
    })

    it('respeta BETTER_AUTH_URL', () => {
      expect(
        resolveAuthOrigins({
          NODE_ENV: 'development',
          BETTER_AUTH_URL: 'http://localhost:3001',
        }).baseURL,
      ).toBe('http://localhost:3001')
    })
  })

  describe('production', () => {
    const env = {
      NODE_ENV: 'production',
      VERCEL_ENV: 'production',
      BETTER_AUTH_URL: 'https://questlog-neon.vercel.app',
    }

    it('confía solo en los dominios de producción', () => {
      expect(resolveAuthOrigins(env)).toEqual({
        baseURL: 'https://questlog-neon.vercel.app',
        trustedOrigins: PRODUCTION_ORIGINS,
      })
    })

    it('no confía en URLs de preview ni en hosts ajenos', () => {
      const { trustedOrigins } = resolveAuthOrigins({
        ...env,
        VERCEL_URL: PREVIEW_URL,
      })
      expect(trustedOrigins).not.toContain(`https://${PREVIEW_URL}`)
      expect(trustedOrigins).not.toContain(FOREIGN_ORIGIN)
    })

    it('falla sin BETTER_AUTH_URL en Vercel', () => {
      expect(() =>
        resolveAuthOrigins({
          NODE_ENV: 'production',
          VERCEL_ENV: 'production',
        }),
      ).toThrow('BETTER_AUTH_URL is not set')
    })

    it('falla sin BETTER_AUTH_URL en un build de producción fuera de Vercel', () => {
      expect(() => resolveAuthOrigins({ NODE_ENV: 'production' })).toThrow(
        'BETTER_AUTH_URL is not set',
      )
    })
  })

  describe('preview', () => {
    const env = {
      NODE_ENV: 'production',
      VERCEL_ENV: 'preview',
      VERCEL_URL: PREVIEW_URL,
      VERCEL_BRANCH_URL: PREVIEW_BRANCH_URL,
      // Valor compartido por todos los previews: debe ignorarse
      BETTER_AUTH_URL: 'https://questlog-neon.vercel.app',
    }

    it('confía exactamente en las URLs del propio deployment', () => {
      expect(resolveAuthOrigins(env)).toEqual({
        baseURL: `https://${PREVIEW_URL}`,
        trustedOrigins: [
          `https://${PREVIEW_URL}`,
          `https://${PREVIEW_BRANCH_URL}`,
        ],
      })
    })

    it('funciona sin VERCEL_BRANCH_URL', () => {
      expect(
        resolveAuthOrigins({ ...env, VERCEL_BRANCH_URL: undefined })
          .trustedOrigins,
      ).toEqual([`https://${PREVIEW_URL}`])
    })

    it('no confía en producción ni en hosts ajenos', () => {
      const { trustedOrigins } = resolveAuthOrigins(env)
      expect(trustedOrigins).not.toContain(FOREIGN_ORIGIN)
      for (const origin of PRODUCTION_ORIGINS) {
        expect(trustedOrigins).not.toContain(origin)
      }
    })

    it('falla sin VERCEL_URL', () => {
      expect(() =>
        resolveAuthOrigins({ NODE_ENV: 'production', VERCEL_ENV: 'preview' }),
      ).toThrow('VERCEL_URL is not set')
    })
  })

  it('nunca devuelve patrones ni comodines', () => {
    const envs = [
      { NODE_ENV: 'development' },
      {
        VERCEL_ENV: 'production',
        BETTER_AUTH_URL: 'https://questlog-neon.vercel.app',
      },
      {
        VERCEL_ENV: 'preview',
        VERCEL_URL: PREVIEW_URL,
        VERCEL_BRANCH_URL: PREVIEW_BRANCH_URL,
      },
    ]
    for (const env of envs) {
      const { baseURL, trustedOrigins } = resolveAuthOrigins(env)
      for (const value of [baseURL, ...trustedOrigins]) {
        expect(value).not.toMatch(/[*?]/)
      }
    }
  })

  describe('BETTER_AUTH_TRUSTED_ORIGINS (solo desarrollo)', () => {
    const LOCAL_ORIGINS = 'http://b.localhost:3001,http://c.localhost:3001'

    it('falla al arrancar si está definida en producción', () => {
      expect(() =>
        resolveAuthOrigins({
          VERCEL_ENV: 'production',
          BETTER_AUTH_URL: 'https://questlog-neon.vercel.app',
          BETTER_AUTH_TRUSTED_ORIGINS: LOCAL_ORIGINS,
        }),
      ).toThrow('BETTER_AUTH_TRUSTED_ORIGINS must not be set on Vercel')
    })

    it('falla al arrancar si está definida en un preview', () => {
      expect(() =>
        resolveAuthOrigins({
          VERCEL_ENV: 'preview',
          VERCEL_URL: PREVIEW_URL,
          BETTER_AUTH_TRUSTED_ORIGINS: LOCAL_ORIGINS,
        }),
      ).toThrow('BETTER_AUTH_TRUSTED_ORIGINS must not be set on Vercel')
    })

    it('se permite en desarrollo', () => {
      expect(() =>
        resolveAuthOrigins({
          NODE_ENV: 'development',
          BETTER_AUTH_TRUSTED_ORIGINS: LOCAL_ORIGINS,
        }),
      ).not.toThrow()
    })
  })
})
