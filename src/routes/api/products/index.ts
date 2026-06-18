import { createFileRoute } from '@tanstack/react-router'
import { db } from '#/db/index.ts'
import { imdbRecords } from '#/db/schema.ts'
import * as schema from '#/db/schema.ts'
import { eq, and, or, like, count, asc, desc } from 'drizzle-orm'

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
          const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'))
          const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '50')))
          const offset = (page - 1) * limit
          const sortBy = url.searchParams.get('sortBy')
          const sortDir = url.searchParams.get('sortDir') === 'desc' ? 'desc' : 'asc'

          // Allowed sort columns (IMDB columns + metadata)
          const SORTABLE_COLUMNS = [
            'ITEM_NAME', 'BARCODE', 'MANUFACTURER', 'BRAND', 'WEIGHT',
            'PACKAGING_TYPE', 'COUNTRY', 'VARIANT', 'TYPE',
            'FRAGRANCE_FLAVOR', 'PROMOTION', 'ADDONS', 'TAGLINE',
            'confidence', 'createdAt',
          ]

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

          // 5. Build orderBy
          const orderByCol = SORTABLE_COLUMNS.includes(sortBy || '') ? sortBy! : 'createdAt'
          const orderByFn = sortDir === 'desc' ? desc : asc
          const orderByClause = orderByFn((imdbRecords as any)[orderByCol])

          // 6. Count total matching records
          const countResult = await db.select({ total: count() })
            .from(imdbRecords)
            .where(and(...filters))

          const total = Number(countResult[0]?.total || 0)

          // 7. Query paginated + sorted records
          const records = await db.select()
            .from(imdbRecords)
            .where(and(...filters))
            .orderBy(orderByClause)
            .limit(limit)
            .offset(offset)

          return new Response(JSON.stringify({
            success: true,
            records: records.map(r => ({
              ...r,
              rawExtraction: typeof r.rawExtraction === 'string' ? JSON.parse(r.rawExtraction) : r.rawExtraction,
              fieldMetadata: typeof r.fieldMetadata === 'string' ? JSON.parse(r.fieldMetadata) : r.fieldMetadata,
            })),
            total,
            page,
            limit,
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
