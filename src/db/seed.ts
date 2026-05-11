/**
 * Script de seed — pobla la tabla `quests` con 3 registros de ejemplo.
 * Ejecutar con: pnpm db:seed
 */
import { config } from 'dotenv'


import { drizzle } from 'drizzle-orm/node-postgres'
import * as schema from './schema.ts'
import type { NewQuest } from './schema.ts'

config({ path: ['.env.local', '.env'] })

const db = drizzle(process.env.DATABASE_URL!, { schema })

const seedQuests: NewQuest[] = [
  {
    title: 'Design onboarding flow',
    description:
      'Create wireframes and user journey for the new user onboarding experience, covering account setup, profile customization, and first quest creation.',
    status: 'in_progress',
    priority: 'high',
    tags: ['design', 'ux', 'onboarding'],
    dueDate: new Date('2026-05-15T17:00:00Z'),
  },
  {
    title: 'Set up CI/CD pipeline',
    description:
      'Configure GitHub Actions workflows for automated testing, linting, and deployment to Vercel on every push to main.',
    status: 'todo',
    priority: 'medium',
    tags: ['devops', 'automation', 'ci-cd'],
    dueDate: new Date('2026-05-20T17:00:00Z'),
  },
  {
    title: 'Write unit tests for auth module',
    description:
      'Cover login, registration, and session-refresh flows with Vitest. Target ≥80 % branch coverage.',
    status: 'backlog',
    priority: 'low',
    tags: ['testing', 'auth', 'vitest'],
    dueDate: null,
  },
]

async function seed() {
  console.log('🌱 Iniciando seed de la tabla quests...')

  const inserted = await db.insert(schema.quests).values(seedQuests).returning()

  console.log(`✅ ${inserted.length} quests insertadas:`)
  inserted.forEach((quest) => {
    console.log(`  • [${quest.id}] ${quest.title} (${quest.status} / ${quest.priority})`)
  })

  process.exit(0)
}

seed().catch((err) => {
  console.error('❌ Error durante el seed:', err)
  process.exit(1)
})
