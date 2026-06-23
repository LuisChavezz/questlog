import { config } from 'dotenv'
import { defineConfig } from 'drizzle-kit'

config({ path: ['.env.local', '.env'] })

export default defineConfig({
  out: './drizzle',
  schema: './src/db/schema/index.ts',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
    // Supabase exige SSL; drizzle-kit no lo activa por defecto ni respeta
    // `sslmode` en la URL, así que lo habilitamos explícitamente.
    ssl: { rejectUnauthorized: false },
  },
})
