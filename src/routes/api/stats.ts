import { createFileRoute } from '@tanstack/react-router'
import { db } from '#/db/index.ts'
import { jobs, imdbRecords, duplicatePairs } from '#/db/schema.ts'
import * as schema from '#/db/schema.ts'
import { eq, and, count, avg, sql } from 'drizzle-orm'

export interface StatsPayload {
  success: boolean;
  stats: {
    totalProducts: number;
    meanConfidence: number;
    flaggedCount: number;
    totalJobs: number;
    pendingDuplicates: number;
  };
  daily: {
    products: { time: string; value: number }[];
    confidence: { time: string; value: number }[];
    flagged: { time: string; value: number }[];
  };
}

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

          const { getCachedStats, putCachedStats } = await import('#/lib/kv-cache.ts')
          const cached = await getCachedStats(orgId)
          if (cached) {
            return new Response(JSON.stringify(cached), {
              status: 200,
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

          // 4. Daily time-series for sparklines (last 8 days) — single grouped query
          const days = 8
          const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

          const dailyRows = await db.select({
            day: sql<string>`date(${imdbRecords.createdAt})`,
            cnt: count(),
            avg_conf: avg(imdbRecords.confidence),
            flagged_cnt: sql<number>`sum(case when ${imdbRecords.flagged} = 1 then 1 else 0 end)`
          })
            .from(imdbRecords)
            .where(and(
              eq(imdbRecords.organisationId, orgId),
              eq(imdbRecords.status, 'ACTIVE'),
              sql`date(${imdbRecords.createdAt}) >= ${cutoffDate}`
            ))
            .groupBy(sql`date(${imdbRecords.createdAt})`)
            .orderBy(sql`date(${imdbRecords.createdAt}) ASC`)
            .catch(() => [] as any[])

          // Build a map from date string to row data
          const dayMap = new Map<string, { cnt: number; avg_conf: number | null; flagged_cnt: number }>()
          for (const row of dailyRows) {
            dayMap.set(row.day, {
              cnt: row.cnt != null ? Number(row.cnt) : 0,
              avg_conf: row.avg_conf != null ? Number(row.avg_conf) : null,
              flagged_cnt: row.flagged_cnt != null ? Number(row.flagged_cnt) : 0
            })
          }

          // Fill last 8 days, including days with no data
          const dailyProducts: { time: string; value: number }[] = []
          const dailyConfidence: { time: string; value: number }[] = []
          const dailyFlagged: { time: string; value: number }[] = []

          for (let i = days - 1; i >= 0; i--) {
            const dayDate = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
            const dateStr = dayDate.toISOString().slice(0, 10)
            const label = dayDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            const row = dayMap.get(dateStr)

            dailyProducts.push({ time: label, value: row?.cnt ?? 0 })
            const rawAvgConf = row?.avg_conf ?? 0
            dailyConfidence.push({ time: label, value: Number(rawAvgConf.toFixed(2)) })
            dailyFlagged.push({ time: label, value: row?.flagged_cnt ?? 0 })
          }

          const payload: StatsPayload = {
            success: true,
            stats: {
              totalProducts: productStats[0]?.totalProducts ?? 0,
              meanConfidence: Number(productStats[0]?.meanConfidence ?? 0),
              flaggedCount: flaggedStats[0]?.flaggedCount ?? 0,
              totalJobs: jobStats[0]?.totalJobs ?? 0,
              pendingDuplicates: dupStats[0]?.pendingDuplicates ?? 0,
            },
            daily: {
              products: dailyProducts,
              confidence: dailyConfidence,
              flagged: dailyFlagged,
            }
          }

          await putCachedStats(orgId, payload)

          return new Response(JSON.stringify(payload), {
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
