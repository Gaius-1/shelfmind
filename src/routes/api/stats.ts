import { createFileRoute } from '@tanstack/react-router'
import { db } from '#/db/index.ts'
import { jobs, imdbRecords, duplicatePairs } from '#/db/schema.ts'
import * as schema from '#/db/schema.ts'
import { eq, and, count, avg } from 'drizzle-orm'

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

          // 3. Aggregate stats

          // Total active products and mean confidence
          const productStats = await db.select({
            totalProducts: count(),
            meanConfidence: avg(imdbRecords.confidence),
          })
            .from(imdbRecords)
            .where(and(
              eq(imdbRecords.organisationId, orgId),
              eq(imdbRecords.status, 'ACTIVE')
            ))

          // Flagged count
          const flaggedStats = await db.select({
            flaggedCount: count(),
          })
            .from(imdbRecords)
            .where(and(
              eq(imdbRecords.organisationId, orgId),
              eq(imdbRecords.status, 'ACTIVE'),
              eq(imdbRecords.flagged, true)
            ))

          // Total jobs
          const jobStats = await db.select({
            totalJobs: count(),
          })
            .from(jobs)
            .where(eq(jobs.organisationId, orgId))

          // Pending duplicates
          const dupStats = await db.select({
            pendingDuplicates: count(),
          })
            .from(duplicatePairs)
            .where(and(
              eq(duplicatePairs.orgId, orgId),
              eq(duplicatePairs.status, 'PENDING')
            ))

          return new Response(JSON.stringify({
            success: true,
            stats: {
              totalProducts: productStats[0]?.totalProducts ?? 0,
              meanConfidence: Number(productStats[0]?.meanConfidence ?? 0),
              flaggedCount: flaggedStats[0]?.flaggedCount ?? 0,
              totalJobs: jobStats[0]?.totalJobs ?? 0,
              pendingDuplicates: dupStats[0]?.pendingDuplicates ?? 0,
            }
          }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          })

        } catch (err: any) {
          console.error('[API] Get stats failed:', err)
          return new Response(JSON.stringify({ error: err?.message || String(err) }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          })
        }
      }
    }
  }
}

export const Route = createFileRoute('/api/stats')(routeOptions)
