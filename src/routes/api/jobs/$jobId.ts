import { createFileRoute } from '@tanstack/react-router'
import { auth } from '#/lib/auth.ts'
import { db } from '#/db/index.ts'
import { jobs } from '#/db/schema.ts'
import * as schema from '#/db/schema.ts'
import { eq, and } from 'drizzle-orm'

const routeOptions: any = {
  server: {
    handlers: {
      GET: async ({ request, params }: { request: Request; params: { jobId: string } }) => {
        try {
          // 1. Authenticate user
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

          // 3. Fetch job details
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

          return new Response(JSON.stringify({
            success: true,
            job: jobResults[0]
          }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          })

        } catch (err: any) {
          console.error('[API] Get job status failed:', err)
          return new Response(JSON.stringify({ error: err?.message || String(err) }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          })
        }
      }
    }
  }
}

export const Route = createFileRoute('/api/jobs/$jobId')(routeOptions)
