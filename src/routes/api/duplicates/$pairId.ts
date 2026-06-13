import { createFileRoute } from '@tanstack/react-router'
import { auth } from '#/lib/auth.ts'
import { db } from '#/db/index.ts'
import { imdbRecords, duplicatePairs } from '#/db/schema.ts'
import * as schema from '#/db/schema.ts'
import { eq, and } from 'drizzle-orm'
import { IMDB_COLUMNS, FIELD_WEIGHTS, CONFIDENCE_THRESHOLD } from '#/types/imdb.ts'
import type { ImdbColumnName, FieldMeta } from '#/types/imdb.ts'

const routeOptions: any = {
  server: {
    handlers: {
      PATCH: async ({ request, params }: { request: Request; params: { pairId: string } }) => {
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

          const { pairId } = params

          // 3. Parse request body
          const body = await request.json() as { action: 'DISMISS' | 'MERGE' }
          if (!body.action || !['DISMISS', 'MERGE'].includes(body.action)) {
            return new Response(JSON.stringify({ error: 'Invalid action. Must be "DISMISS" or "MERGE".' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' }
            })
          }

          // 4. Load the duplicate pair
          const pairResults = await db.select()
            .from(duplicatePairs)
            .where(and(
              eq(duplicatePairs.id, pairId),
              eq(duplicatePairs.orgId, orgId),
              eq(duplicatePairs.status, 'PENDING')
            ))
            .limit(1)

          if (pairResults.length === 0) {
            return new Response(JSON.stringify({ error: 'Duplicate pair not found' }), {
              status: 404,
              headers: { 'Content-Type': 'application/json' }
            })
          }

          const pair = pairResults[0]
          const now = new Date().toISOString()

          if (body.action === 'DISMISS') {
            // 5a. Dismiss — just update pair status
            await db.update(duplicatePairs)
              .set({ status: 'DISMISSED', resolvedAt: now })
              .where(eq(duplicatePairs.id, pairId))

            const updatedPair = { ...pair, status: 'DISMISSED', resolvedAt: now }

            return new Response(JSON.stringify({
              success: true,
              pair: updatedPair,
            }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' }
            })
          }

          // 5b. Merge — enrich A from B, soft-delete B
          const [recordsA, recordsB] = await Promise.all([
            db.select().from(imdbRecords).where(eq(imdbRecords.id, pair.recordAId)).limit(1),
            db.select().from(imdbRecords).where(eq(imdbRecords.id, pair.recordBId)).limit(1),
          ])

          if (recordsA.length === 0 || recordsB.length === 0) {
            return new Response(JSON.stringify({ error: 'One or both records not found' }), {
              status: 404,
              headers: { 'Content-Type': 'application/json' }
            })
          }

          const recordA = recordsA[0]
          const recordB = recordsB[0]

          // Enrich Record A: copy B's non-empty fields where A is empty
          const fieldMetaA = (recordA.fieldMetadata ?? {}) as Record<string, FieldMeta>
          const fieldMetaB = (recordB.fieldMetadata ?? {}) as Record<string, FieldMeta>
          const fieldUpdates: Record<string, any> = {}

          for (const col of IMDB_COLUMNS) {
            const aVal = (recordA as any)[col] as string | null
            const bVal = (recordB as any)[col] as string | null

            if ((!aVal || aVal.trim() === '') && bVal && bVal.trim() !== '') {
              fieldUpdates[col] = bVal
              if (fieldMetaB[col]) {
                fieldMetaA[col] = fieldMetaB[col]
              }
            }
          }

          // Recalculate A's overall weighted confidence
          let totalWeight = 0
          let weightedSum = 0
          for (const col of IMDB_COLUMNS) {
            const weight = FIELD_WEIGHTS[col]
            const meta = fieldMetaA[col]
            if (meta) {
              weightedSum += meta.confidence * weight
            }
            totalWeight += weight
          }
          const newConfidence = totalWeight > 0 ? weightedSum / totalWeight : 0
          const newFlagged = newConfidence < CONFIDENCE_THRESHOLD

          // Update Record A
          await db.update(imdbRecords)
            .set({
              ...fieldUpdates,
              fieldMetadata: fieldMetaA,
              confidence: newConfidence,
              flagged: newFlagged,
              updatedAt: now,
            })
            .where(eq(imdbRecords.id, recordA.id))

          // Soft-delete Record B
          await db.update(imdbRecords)
            .set({
              status: 'DELETED',
              mergedIntoId: recordA.id,
              updatedAt: now,
            })
            .where(eq(imdbRecords.id, recordB.id))

          // Update pair status
          await db.update(duplicatePairs)
            .set({ status: 'MERGED', resolvedAt: now })
            .where(eq(duplicatePairs.id, pairId))

          const updatedPair = { ...pair, status: 'MERGED', resolvedAt: now }

          return new Response(JSON.stringify({
            success: true,
            pair: updatedPair,
          }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          })

        } catch (err: any) {
          console.error('[API] Resolve duplicate pair failed:', err)
          return new Response(JSON.stringify({ error: err?.message || String(err) }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          })
        }
      }
    }
  }
}

export const Route = createFileRoute('/api/duplicates/$pairId')(routeOptions)
