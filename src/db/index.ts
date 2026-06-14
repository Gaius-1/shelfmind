import * as schema from './schema.ts'
import { drizzle as drizzleD1 } from 'drizzle-orm/d1'
import { getBinding } from '../lib/cloudflare.ts'

let _db: any = null

function getDatabaseInstance() {
  if (_db) return _db

  // Detect D1 database binding
  const d1Binding = getBinding('DB')

  if (d1Binding) {
    // We are running in Cloudflare D1 environment
    _db = drizzleD1(d1Binding, { schema })
    console.log('Using Cloudflare D1 database connection')
  } else {
    // Fallback to local Bun SQLite database using globalThis.require to bypass bundler static analysis
    const req = (globalThis as any).require
    if (!req) {
      throw new Error('Database fallback require is not available in this environment')
    }
    const { drizzle: drizzleSqlite } = req('drizzle-orm/bun-sqlite')
    const { Database } = req('bun:sqlite')
    const sqlite = new Database(process.env.DATABASE_URL || 'dev.db')
    _db = drizzleSqlite(sqlite, { schema })
    console.log('Using Bun SQLite database connection')
  }

  return _db
}

// Export a proxy so database queries can be executed seamlessly
export const db = new Proxy({} as any, {
  get(_target, prop, receiver) {
    if (prop === 'then' || prop === '$$typeof' || prop === '__esModule' || prop === 'toJSON' || typeof prop === 'symbol') {
      return undefined
    }
    const instance = getDatabaseInstance()
    const value = Reflect.get(instance, prop, receiver)
    return typeof value === 'function' ? value.bind(instance) : value
  },
  set(_target, prop, value, receiver) {
    if (prop === 'then' || prop === '$$typeof' || prop === '__esModule' || prop === 'toJSON' || typeof prop === 'symbol') {
      return true
    }
    const instance = getDatabaseInstance()
    return Reflect.set(instance, prop, value, receiver)
  }
})

