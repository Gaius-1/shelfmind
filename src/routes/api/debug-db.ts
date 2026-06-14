import { createFileRoute } from '@tanstack/react-router'
import { db } from '#/db/index.ts'
import { getBinding } from '#/lib/cloudflare.ts'
import * as schema from '#/db/schema.ts'

const routeOptions: any = {
  server: {
    handlers: {
      GET: async () => {
        const results: any = {}
        try {
          const dbBinding = getBinding('DB')
          results.hasDbBinding = !!dbBinding
          results.dbBindingType = typeof dbBinding
          results.dbBindingString = String(dbBinding)
          results.dbBindingConstructor = dbBinding?.constructor?.name || null
          results.dbBindingProps = dbBinding ? Object.getOwnPropertyNames(dbBinding) : []

          results.globalThisDb = typeof (globalThis as any).DB
          results.globalThisDbString = String((globalThis as any).DB)
          results.globalThisDbConstructor = (globalThis as any).DB?.constructor?.name || null

          results.processEnvDb = typeof (process.env as any).DB
          results.processEnvDbString = String((process.env as any).DB)
          results.processEnvDbConstructor = (process.env as any).DB?.constructor?.name || null

          if (dbBinding) {
            try {
              const rawTest = await dbBinding.prepare("SELECT 1 as val").all()
              results.rawD1Success = true
              results.rawD1Data = rawTest
            } catch (rawErr: any) {
              results.rawD1Success = false
              results.rawD1Error = {
                name: rawErr?.name,
                message: rawErr?.message,
                stack: rawErr?.stack,
              }
            }
          }

          try {
            const testQuery = await db.select().from(schema.user).limit(1)
            results.drizzleSuccess = true
            results.drizzleData = testQuery
          } catch (drizzleErr: any) {
            results.drizzleSuccess = false
            results.drizzleError = {
              name: drizzleErr?.name,
              message: drizzleErr?.message,
              stack: drizzleErr?.stack,
            }
          }

          return new Response(JSON.stringify({
            status: "success",
            results,
            hasSecret: !!getBinding('BETTER_AUTH_SECRET'),
          }), {
            headers: { 'Content-Type': 'application/json' }
          })
        } catch (e: any) {
          return new Response(JSON.stringify({
            status: "error",
            errorName: e?.name || (e instanceof Error ? e.constructor.name : typeof e),
            message: e?.message || String(e),
            stack: e?.stack,
            cause: e?.cause ? {
              message: e.cause.message,
              stack: e.cause.stack,
              name: e.cause.name
            } : null,
            results
          }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          })
        }
      }
    }
  }
}

export const Route = createFileRoute('/api/debug-db')(routeOptions)

