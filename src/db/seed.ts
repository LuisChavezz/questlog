/**
 * Script de seed — Clear and Set de datos de prueba:
 *   - Limpia las tablas afectadas antes de insertar
 *   - Crea un usuario de prueba via Better Auth API
 *
 * Ejecutar con: npm run db:seed
 *
 * Requiere variables de entorno: DATABASE_URL, BETTER_AUTH_SECRET, BETTER_AUTH_URL
 */
import { config } from 'dotenv'
import { drizzle } from 'drizzle-orm/node-postgres'
import * as schema from './schema'
import { account, session, user, verification } from './auth-schema.ts'

// dotenv debe cargarse ANTES de que los módulos que leen process.env sean evaluados.
// Por eso `auth` se importa dinámicamente a continuación, no de forma estática.
config({ path: ['.env.local', '.env'] })

// Importación dinámica — se resuelve DESPUÉS de que dotenv cargó las variables,
// garantizando que BETTER_AUTH_SECRET y BETTER_AUTH_URL estén disponibles al
// construir el objeto `auth` dentro de better-auth.
const { auth } = await import('../lib/auth.ts')

const db = drizzle(process.env.DATABASE_URL!, { schema })

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

async function seed() {
  await seedUser()

  console.log('\n🎉 Seed completado.')
  process.exit(0)
}

seed().catch((err) => {
  console.error('❌ Error durante el seed:', err)
  process.exit(1)
})
