import { createFileRoute } from '@tanstack/react-router'
import { auth } from '#/lib/auth.ts'
import { db } from '#/db/index.ts'
import { imdbRecords } from '#/db/schema.ts'
import * as schema from '#/db/schema.ts'
import { eq, and } from 'drizzle-orm'
import { IMDB_COLUMNS, FIELD_WEIGHTS, CONFIDENCE_THRESHOLD } from '#/types/imdb.ts'
import type { ImdbColumnName, FieldMeta } from '#/types/imdb.ts'

const routeOptions: any = {
  server: {
    handlers: {
      GET: async ({ request, params }: { request: Request; params: { recordId: string } }) => {
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

          const { recordId } = params

          // 3. Fetch record
          const results = await db.select()
            .from(imdbRecords)
            .where(and(
              eq(imdbRecords.id, recordId),
              eq(imdbRecords.organisationId, orgId),
              eq(imdbRecords.status, 'ACTIVE')
            ))
            .limit(1)

          if (results.length === 0) {
            return new Response(JSON.stringify({ error: 'Record not found' }), {
              status: 404,
              headers: { 'Content-Type': 'application/json' }
            })
          }

          const record = results[0]

          return new Response(JSON.stringify({
            success: true,
            record: {
              ...record,
              rawExtraction: typeof record.rawExtraction === 'string' ? JSON.parse(record.rawExtraction) : record.rawExtraction,
              fieldMetadata: typeof record.fieldMetadata === 'string' ? JSON.parse(record.fieldMetadata) : record.fieldMetadata,
            }
          }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          })

        } catch (err: any) {
          console.error('[API] Get record failed:', err)
          return new Response(JSON.stringify({ error: err?.message || String(err) }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          })
        }
      },
      PATCH: async ({ request, params }: { request: Request; params: { recordId: string } }) => {
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

          const { recordId } = params

          // 3. Parse request body
          const body = await request.json() as { fields: Record<string, string> }
          if (!body.fields || typeof body.fields !== 'object') {
            return new Response(JSON.stringify({ error: 'Missing or invalid "fields" in request body' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' }
            })
          }

          // 4. Load existing record
          const existing = await db.select()
            .from(imdbRecords)
            .where(and(
              eq(imdbRecords.id, recordId),
              eq(imdbRecords.organisationId, orgId),
              eq(imdbRecords.status, 'ACTIVE')
            ))
            .limit(1)

          if (existing.length === 0) {
            return new Response(JSON.stringify({ error: 'Record not found' }), {
              status: 404,
              headers: { 'Content-Type': 'application/json' }
            })
          }

          const record = existing[0]
          const fieldMetadata = (record.fieldMetadata ?? {}) as Record<string, FieldMeta>
          const updates: Record<string, any> = {}

          // 5. Apply field edits
          for (const [col, newValue] of Object.entries(body.fields)) {
            if (!IMDB_COLUMNS.includes(col as ImdbColumnName)) continue

            updates[col] = newValue
            fieldMetadata[col] = {
              value: newValue,
              source: 'Merged',
              confidence: 1.0,
            }
          }

          // 6. Recalculate overall weighted confidence
          let totalWeight = 0
          let weightedSum = 0
          for (const col of IMDB_COLUMNS) {
            const weight = FIELD_WEIGHTS[col]
            const meta = fieldMetadata[col]
            if (meta) {
              weightedSum += meta.confidence * weight
            }
            totalWeight += weight
          }
          const newConfidence = totalWeight > 0 ? weightedSum / totalWeight : 0
          const newFlagged = newConfidence < CONFIDENCE_THRESHOLD

          // 7. Commit updates
          const now = new Date().toISOString()
          await db.update(imdbRecords)
            .set({
              ...updates,
              fieldMetadata,
              confidence: newConfidence,
              flagged: newFlagged,
              updatedAt: now,
            })
            .where(eq(imdbRecords.id, recordId))

          // 8. Return updated record
          const updated = await db.select()
            .from(imdbRecords)
            .where(eq(imdbRecords.id, recordId))
            .limit(1)

          return new Response(JSON.stringify({
            success: true,
            record: {
              ...updated[0],
              rawExtraction: typeof updated[0].rawExtraction === 'string' ? JSON.parse(updated[0].rawExtraction) : updated[0].rawExtraction,
              fieldMetadata: typeof updated[0].fieldMetadata === 'string' ? JSON.parse(updated[0].fieldMetadata) : updated[0].fieldMetadata,
            },
          }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          })

        } catch (err: any) {
          console.error('[API] Patch record failed:', err)
          return new Response(JSON.stringify({ error: err?.message || String(err) }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          })
        }
      }
    }
  }
}

export const Route = createFileRoute('/api/records/$recordId')(routeOptions)
