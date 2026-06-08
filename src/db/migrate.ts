import { migrate } from 'drizzle-orm/bun-sqlite/migrator'
import { db } from './index.ts'

console.log('Running migrations...')
try {
  await migrate(db, { migrationsFolder: './drizzle' })
  console.log('Migrations applied successfully!')
} catch (error) {
  console.error('Failed to run migrations:', error)
  process.exit(1)
}
