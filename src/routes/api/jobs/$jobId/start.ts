import { createFileRoute } from '@tanstack/react-router'
import { db } from '#/db/index.ts'
import { jobs } from '#/db/schema.ts'
import * as schema from '#/db/schema.ts'
import { eq, and } from 'drizzle-orm'
import { dispatchJob } from '#/lib/queue.ts'
import { listUploads } from '#/lib/storage.ts'

const routeOptions: any = {
  server: {
    handlers: {
      POST: async ({ request, params }: { request: Request; params: { jobId: string } }) => {
        try {
          const { jobId } = params

          // 1. Authenticate user
          const { auth } = await import('#/lib/auth.ts')
          const session = await auth.api.getSession({ headers: request.headers })
          if (!session) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
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
            return new Response(JSON.stringify({ error: 'No active organization' }), { status: 400 })
          }

          // 3. Verify Job exists and is in UPLOADING state
          const jobArray = await db.select()
            .from(jobs)
            .where(
              and(
                eq(jobs.id, jobId),
                eq(jobs.organisationId, orgId),
                eq(jobs.status, 'UPLOADING')
              )
            )
            .limit(1)

          if (jobArray.length === 0) {
            return new Response(JSON.stringify({ error: 'Job not found or not in UPLOADING state' }), { status: 404 })
          }

          // 4. Update status to PENDING
          await db.update(jobs)
            .set({ status: 'PENDING' })
            .where(eq(jobs.id, jobId))

          // 5. Gather uploaded files and dispatch
          const imageKeys = await listUploads(orgId as string, jobId)
          
          if (imageKeys.length === 0) {
             return new Response(JSON.stringify({ error: 'No files were uploaded to this job' }), { status: 400 })
          }

          // Trigger processing in the background
          await dispatchJob(jobId, orgId as string, imageKeys)

          return new Response(JSON.stringify({ success: true, imageCount: imageKeys.length }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          })

        } catch (err: any) {
          console.error(`[API] Job start failed for ${params?.jobId}:`, err)
          return new Response(JSON.stringify({ error: err?.message || String(err) }), { status: 500 })
        }
      }
    }
  }
}

export const Route = createFileRoute('/api/jobs/$jobId/start')(routeOptions)
