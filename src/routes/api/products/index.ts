import { createFileRoute } from '@tanstack/react-router'
import { db } from '#/db/index.ts'
import { imdbRecords } from '#/db/schema.ts'
import * as schema from '#/db/schema.ts'
import { eq, and, or, like } from 'drizzle-orm'

const routeOptions: any = {
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        try {
          // 1. Authenticate user
          const { auth } = await import('#/lib/auth.ts')
          const session = await auth.api.getSession({ headers: request.headers })
          if (!session) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
              status: 401,
              headers: { 'Content-Type': 'application/json' }
            })
          }

          // 2. Resolve Organization ID
          let orgId = session.session.activeOrganizationId
          if (!orgId) {
            const memberships = await db.select()
              .from(schema.member)
              .where(eq(schema.member.userId, session.user.id))
              .limit(1)
            orgId = memberships[0]?.organizationId || null
          }

          if (!orgId) {
            return new Response(JSON.stringify({ error: 'No active organization found' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' }
            })
          }

          // 3. Parse optional query params
          const url = new URL(request.url)
          const search = url.searchParams.get('search')
          const flagged = url.searchParams.get('flagged')

          // 4. Build filters
          const filters: any[] = [
            eq(imdbRecords.organisationId, orgId),
            eq(imdbRecords.status, 'ACTIVE'),
          ]

          if (search) {
            const pattern = `%${search}%`
            filters.push(
              or(
                like(imdbRecords.ITEM_NAME, pattern),
                like(imdbRecords.BRAND, pattern),
                like(imdbRecords.BARCODE, pattern),
                like(imdbRecords.MANUFACTURER, pattern),
              )
            )
          }

          if (flagged === 'true') {
            filters.push(eq(imdbRecords.flagged, true))
          }

          // 5. Query records
          const records = await db.select()
            .from(imdbRecords)
            .where(and(...filters))

          return new Response(JSON.stringify({
            success: true,
            records: records.map(r => ({
              ...r,
              rawExtraction: typeof r.rawExtraction === 'string' ? JSON.parse(r.rawExtraction) : r.rawExtraction,
              fieldMetadata: typeof r.fieldMetadata === 'string' ? JSON.parse(r.fieldMetadata) : r.fieldMetadata,
            })),
          }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          })

        } catch (err: any) {
          console.error('[API] Get products failed:', err)
          return new Response(JSON.stringify({ error: err?.message || String(err) }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          })
        }
      }
    }
  }
}

export const Route = createFileRoute('/api/products/')(routeOptions)
