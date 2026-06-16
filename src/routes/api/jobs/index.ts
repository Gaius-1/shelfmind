import { createFileRoute } from '@tanstack/react-router'
import { db } from '#/db/index.ts'
import { jobs } from '#/db/schema.ts'
import * as schema from '#/db/schema.ts'
import { eq, lt, and } from 'drizzle-orm'
import { deleteUploads } from '#/lib/storage.ts'

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

          // 3. Fetch jobs, ordered by startedAt desc or fallback to id desc
          const jobsList = await db.select()
            .from(jobs)
            .where(eq(jobs.organisationId, orgId))

          // Sort in JS to handle pending jobs that don't have startedAt yet (most recent first)
          const sortedJobs = jobsList.sort((a, b) => {
            if (!a.startedAt && !b.startedAt) return b.id.localeCompare(a.id)
            if (!a.startedAt) return -1 // a is pending, show first
            if (!b.startedAt) return 1 // b is pending, show first
            return b.startedAt.localeCompare(a.startedAt)
          })

          return new Response(JSON.stringify({ success: true, jobs: sortedJobs }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          })
        } catch (err: any) {
          console.error('[API] Get jobs list failed:', err)
          return new Response(JSON.stringify({ error: err?.message || String(err) }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          })
        }
      },
      POST: async ({ request }: { request: Request }) => {
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

          // 3. Lazy Garbage Collector: Clean up orphaned jobs > 24 hours old
          const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
          const orphanedJobs = await db.select()
            .from(jobs)
            .where(
              and(
                eq(jobs.status, 'UPLOADING'),
                lt(jobs.createdAt, twentyFourHoursAgo)
              )
            )

          for (const orphan of orphanedJobs) {
            await deleteUploads(orphan.organisationId, orphan.id)
            await db.delete(jobs).where(eq(jobs.id, orphan.id))
            console.log(`[GC] Deleted orphaned job ${orphan.id}`)
          }

          // 4. Parse request for total image count
          const body = await request.json().catch(() => ({}))
          const imageCount = body.imageCount || 0

          if (imageCount <= 0 || imageCount > 200) {
            return new Response(JSON.stringify({ error: 'Invalid image count' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' }
            })
          }

          const jobId = crypto.randomUUID()

          // 5. Create job in database with UPLOADING status
          await db.insert(jobs).values({
            id: jobId,
            organisationId: orgId,
            createdBy: session.user.id,
            status: 'UPLOADING',
            progress: 0,
            imageCount: imageCount,
            createdAt: new Date(),
          })

          return new Response(JSON.stringify({ success: true, jobId }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          })

        } catch (err: any) {
          console.error('[API] Job creation failed:', err)
          return new Response(JSON.stringify({ error: err?.message || String(err) }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          })
        }
      }
    }
  }
}

export const Route = createFileRoute('/api/jobs/')(routeOptions)
