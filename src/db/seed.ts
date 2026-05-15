/**
 * Script de seed — Clear and Set de datos de prueba:
 *   - Limpia las tablas afectadas antes de insertar
 *   - Crea un usuario de prueba via Better Auth API
 *   - Inserta quests de ejemplo
 *
 * Ejecutar con: npm run db:seed
 *
 * Requiere variables de entorno: DATABASE_URL, BETTER_AUTH_SECRET, BETTER_AUTH_URL
 */
import { config } from 'dotenv'
import { drizzle } from 'drizzle-orm/node-postgres'
import * as schema from './schema.ts'
import type { NewQuest } from './schema.ts'
import { account, session, user, verification } from './auth-schema.ts'

// dotenv debe cargarse ANTES de que los módulos que leen process.env sean evaluados.
// Por eso `auth` se importa dinámicamente a continuación, no de forma estática.
config({ path: ['.env.local', '.env'] })

// Importación dinámica — se resuelve DESPUÉS de que dotenv cargó las variables,
// garantizando que BETTER_AUTH_SECRET y BETTER_AUTH_URL estén disponibles al
// construir el objeto `auth` dentro de better-auth.
const { auth } = await import('../lib/auth.ts')

const db = drizzle(process.env.DATABASE_URL!, { schema })

const seedQuestData: NewQuest[] = [
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

async function seedUser() {
  console.log('👤 Limpiando tablas de auth...')

  // Orden de borrado respetando FK: los hijos primero, luego el padre.
  // session y account tienen ON DELETE CASCADE desde user, pero los borramos
  // explícitamente para mayor claridad.
  await db.delete(session)
  await db.delete(account)
  await db.delete(verification)
  await db.delete(user)

  console.log('  🗑️  Tablas de auth limpias.')
  console.log('  ➕ Creando usuario de prueba...')

  const TEST_EMAIL = 'test@questlog.dev'
  const TEST_PASSWORD = 'Test1234!'
  const TEST_NAME = 'Test User'

  // signUpEmail usa el mismo hash de contraseña que la autenticación en producción
  await auth.api.signUpEmail({
    body: { email: TEST_EMAIL, password: TEST_PASSWORD, name: TEST_NAME },
  })

  console.log(`  ✅ Usuario creado: ${TEST_EMAIL} / ${TEST_PASSWORD}`)
}

async function seedQuests() {
  console.log('🌱 Limpiando tabla quests...')

  await db.delete(schema.quests)

  console.log('  🗑️  Tabla quests limpia.')
  console.log('  ➕ Insertando quests de ejemplo...')

  const inserted = await db.insert(schema.quests).values(seedQuestData).returning()

  console.log(`  ✅ ${inserted.length} quests insertadas:`)
  inserted.forEach((quest) => {
    console.log(`    • [${quest.id}] ${quest.title} (${quest.status} / ${quest.priority})`)
  })
}

async function seed() {
  await seedUser()
  await seedQuests()

  console.log('\n🎉 Seed completado.')
  process.exit(0)
}

seed().catch((err) => {
  console.error('❌ Error durante el seed:', err)
  process.exit(1)
})
