import { createFileRoute } from '@tanstack/react-router'
import { db } from '#/db/index.ts'
import { jobs } from '#/db/schema.ts'
import * as schema from '#/db/schema.ts'
import { eq, and } from 'drizzle-orm'
import { listUploads } from '#/lib/storage.ts'
import { dispatchJob } from '#/lib/queue.ts'

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

          const job = jobResults[0]

          if (job.status !== 'PENDING' && job.status !== 'FAILED') {
            return new Response(JSON.stringify({ error: 'Only pending or failed jobs can be retried' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' }
            })
          }

          // 4. Retrieve original images
          const imageKeys = await listUploads(orgId, jobId)
          
          if (imageKeys.length === 0) {
            return new Response(JSON.stringify({ error: 'No images found for this job in storage to retry' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' }
            })
          }

          // 5. Reset job state
          await db.update(jobs)
            .set({ 
              status: 'PENDING', 
              progress: 0, 
              error: null,
              startedAt: null,
              completedAt: null
            })
            .where(eq(jobs.id, jobId))

          // 6. Redispatch job
          await dispatchJob(jobId, orgId, imageKeys)

          return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          })

        } catch (err: any) {
          console.error('[API] Retry job failed:', err)
          return new Response(JSON.stringify({ error: err?.message || String(err) }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          })
        }
      }
    }
  }
}

export const Route = createFileRoute('/api/jobs/$jobId/retry')(routeOptions)
