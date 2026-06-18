import { createFileRoute } from '@tanstack/react-router'
import { db } from '#/db/index.ts'
import { jobs, imdbRecords } from '#/db/schema.ts'
import * as schema from '#/db/schema.ts'
import { eq, and, count } from 'drizzle-orm'

const routeOptions: any = {
  server: {
    handlers: {
      GET: async ({ request, params }: { request: Request; params: { jobId: string } }) => {
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

          const { jobId } = params

          // 3. Parse pagination query params
          const url = new URL(request.url)
          const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'))
          const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '50')))
          const offset = (page - 1) * limit

          // 4. Fetch associated job to return its processing status
          const jobResults = await db.select()
            .from(jobs)
            .where(and(eq(jobs.id, jobId), eq(jobs.organisationId, orgId)))
            .limit(1)

          if (jobResults.length === 0) {
            return new Response(JSON.stringify({ error: 'Job not found' }), {
              status: 404,
              headers: { 'Content-Type': 'application/json' }
            })
          }

          const job = jobResults[0]

          // 5. Count total records for this job
          const countResult = await db.select({ total: count() })
            .from(imdbRecords)
            .where(and(eq(imdbRecords.jobId, jobId), eq(imdbRecords.organisationId, orgId)))

          const total = Number(countResult[0]?.total || 0)

          // 6. Fetch paginated records
          const records = await db.select()
            .from(imdbRecords)
            .where(and(eq(imdbRecords.jobId, jobId), eq(imdbRecords.organisationId, orgId)))
            .limit(limit)
            .offset(offset)

          return new Response(JSON.stringify({
            success: true,
            jobStatus: job.status,
            jobProgress: job.progress,
            jobError: job.error,
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
          console.error('[API] Get job records failed:', err)
          return new Response(JSON.stringify({ error: err?.message || String(err) }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          })
        }
      }
    }
  }
}

export const Route = createFileRoute('/api/jobs/$jobId/records')(routeOptions)
