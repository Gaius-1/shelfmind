import { createFileRoute } from '@tanstack/react-router'
import { db } from '#/db/index.ts'
import { getBinding } from '#/lib/cloudflare.ts'
import * as schema from '#/db/schema.ts'

const routeOptions: any = {
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const results: any = {}
        const url = new URL(request.url)
        const clear = url.searchParams.get('clear') === 'true'
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

          try {
            const { auth } = await import('#/lib/auth.ts')
            results.authSuccess = true
            results.authString = String(auth)
          } catch (authErr: any) {
            results.authSuccess = false
            results.authError = {
              name: authErr?.name,
              message: authErr?.message,
              stack: authErr?.stack,
            }
          }

          if (clear) {
            results.cleared = {} as any
            
            // 1. Clear PRODUCT_IMAGES R2 bucket
            const imagesBucket = getBinding('PRODUCT_IMAGES') as any
            if (imagesBucket) {
              results.cleared.imagesBucket = []
              let cursor: string | undefined
              do {
                const list: any = await imagesBucket.list({ cursor })
                if (list?.objects) {
                  for (const obj of list.objects) {
                    await imagesBucket.delete(obj.key)
                    results.cleared.imagesBucket.push(obj.key)
                  }
                }
                cursor = list?.truncated ? list.cursor : undefined
              } while (cursor)
            }

            // 2. Clear EXPORTS R2 bucket
            const exportsBucket = getBinding('EXPORTS') as any
            if (exportsBucket) {
              results.cleared.exportsBucket = []
              let cursor: string | undefined
              do {
                const list: any = await exportsBucket.list({ cursor })
                if (list?.objects) {
                  for (const obj of list.objects) {
                    await exportsBucket.delete(obj.key)
                    results.cleared.exportsBucket.push(obj.key)
                  }
                }
                cursor = list?.truncated ? list.cursor : undefined
              } while (cursor)
            }

            // 3. Clear CACHE KV namespace
            const cacheKv = getBinding('CACHE') as any
            if (cacheKv) {
              results.cleared.cacheKv = []
              let cursor: string | undefined
              do {
                const list: any = await cacheKv.list({ cursor })
                if (list?.keys) {
                  for (const key of list.keys) {
                    await cacheKv.delete(key.name)
                    results.cleared.cacheKv.push(key.name)
                  }
                }
                cursor = list?.truncated ? list.cursor : undefined
              } while (cursor)
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

