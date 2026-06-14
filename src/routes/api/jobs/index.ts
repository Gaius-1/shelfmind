import { createFileRoute } from '@tanstack/react-router'
import { db } from '#/db/index.ts'
import { jobs } from '#/db/schema.ts'
import * as schema from '#/db/schema.ts'
import { eq } from 'drizzle-orm'
import { saveUpload } from '#/lib/storage.ts'
import { dispatchJob } from '#/lib/queue.ts'

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

          // 3. Parse files from multipart form-data
          const formData = await request.formData()
          const files = formData.getAll('files') as File[]

          if (!files || files.length === 0) {
            return new Response(JSON.stringify({ error: 'No files uploaded' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' }
            })
          }

          const jobId = crypto.randomUUID()
          const imageKeys: string[] = []

          // 4. Save uploaded images
          for (let i = 0; i < files.length; i++) {
            const file = files[i]
            const name = file.name || `image_${i}`
            const buffer = await file.arrayBuffer()
            const key = await saveUpload(orgId, jobId, name, buffer)
            imageKeys.push(key)
          }

          // 5. Create job in database
          await db.insert(jobs).values({
            id: jobId,
            organisationId: orgId,
            createdBy: session.user.id,
            status: 'PENDING',
            progress: 0,
            imageCount: files.length,
          })

          // 6. Dispatch processing job to queue/background
          await dispatchJob(jobId, orgId, imageKeys)

          return new Response(JSON.stringify({ success: true, jobId }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          })

        } catch (err: any) {
          console.error('[API] Upload route failed:', err)
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
