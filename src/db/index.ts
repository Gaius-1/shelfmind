import * as schema from './schema.ts'
import { drizzle as drizzleD1 } from 'drizzle-orm/d1'
import { createRequire } from 'module'

const requireInstance = createRequire(import.meta.url)
let _db: any = null

function getDatabaseInstance() {
  if (_db) return _db

  // Detect D1 database binding
  // In Cloudflare Worker environment, the binding DB is available on process.env.DB or globalThis.DB
  const d1Binding = (process.env as any).DB || (globalThis as any).DB

  if (d1Binding) {
    // We are running in Cloudflare D1 environment
    _db = drizzleD1(d1Binding, { schema })
    console.log('Using Cloudflare D1 database connection')
  } else {
    // Fallback to local Bun SQLite database
    const { drizzle: drizzleSqlite } = requireInstance('drizzle-orm/bun-sqlite')
    const { Database } = requireInstance('bun:sqlite')
    const sqlite = new Database(process.env.DATABASE_URL || 'dev.db')
    _db = drizzleSqlite(sqlite, { schema })
    console.log('Using Bun SQLite database connection')
  }

  return _db
}

// Export a proxy so database queries can be executed seamlessly
export const db = new Proxy({} as any, {
  get(target, prop, receiver) {
    const instance = getDatabaseInstance()
    const value = Reflect.get(instance, prop, receiver)
    return typeof value === 'function' ? value.bind(instance) : value
  },
  set(target, prop, value, receiver) {
    const instance = getDatabaseInstance()
    return Reflect.set(instance, prop, value, receiver)
  }
})
