import { createFileRoute } from '@tanstack/react-router'
import { db } from '#/db/index.ts'
import { jobs, imdbRecords } from '#/db/schema.ts'
import * as schema from '#/db/schema.ts'
import { eq, and } from 'drizzle-orm'

const routeOptions: any = {
  server: {
    handlers: {
      POST: async ({ request, params }: { request: Request; params: { jobId: string } }) => {
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
          const body = await request.json().catch(() => ({}))
          const includeMetadata = !!body?.includeMetadata

          // 3. Verify job details and check permissions
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

          // 4. Fetch associated records
          const records = await db.select()
            .from(imdbRecords)
            .where(and(eq(imdbRecords.jobId, jobId), eq(imdbRecords.organisationId, orgId)))

          // 5. Generate Excel Predictions Spreadsheet
          const { generateExcelExport } = await import('#/lib/export.ts')
          const downloadUrl = await generateExcelExport(orgId, jobId, records, includeMetadata)

          return new Response(JSON.stringify({ success: true, downloadUrl }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          })

        } catch (err: any) {
          console.error('[API] Trigger export failed:', err)
          return new Response(JSON.stringify({ error: err?.message || String(err) }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          })
        }
      }
    }
  }
}

export const Route = createFileRoute('/api/jobs/$jobId/export')(routeOptions)
