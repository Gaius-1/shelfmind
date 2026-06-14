import { createFileRoute } from '@tanstack/react-router'
import { db } from '#/db/index.ts'
import { imdbRecords, duplicatePairs } from '#/db/schema.ts'
import * as schema from '#/db/schema.ts'
import { eq, and, inArray } from 'drizzle-orm'

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

          // 3. Fetch pending duplicate pairs
          const pairs = await db.select()
            .from(duplicatePairs)
            .where(and(
              eq(duplicatePairs.orgId, orgId),
              eq(duplicatePairs.status, 'PENDING')
            ))

          if (pairs.length === 0) {
            return new Response(JSON.stringify({ success: true, pairs: [] }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' }
            })
          }

          // 4. Batch fetch all referenced records
          const recordIds = [...new Set(pairs.flatMap(p => [p.recordAId, p.recordBId]))]
          const records = await db.select()
            .from(imdbRecords)
            .where(inArray(imdbRecords.id, recordIds))

          const recordMap = new Map(records.map(r => [r.id, r]))

          // 5. Assemble response with joined data
          const enrichedPairs = pairs.map(pair => ({
            id: pair.id,
            similarityScore: pair.similarityScore,
            reason: pair.reason,
            status: pair.status,
            recordA: recordMap.get(pair.recordAId) ?? null,
            recordB: recordMap.get(pair.recordBId) ?? null,
          }))

          return new Response(JSON.stringify({
            success: true,
            pairs: enrichedPairs,
          }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          })

        } catch (err: any) {
          console.error('[API] Get duplicates failed:', err)
          return new Response(JSON.stringify({ error: err?.message || String(err) }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          })
        }
      }
    }
  }
}

export const Route = createFileRoute('/api/duplicates/')(routeOptions)
