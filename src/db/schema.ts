import { sqliteTable, integer, text, real, index } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

// ─── Better Auth Tables ──────────────────────────────────────────────────────

export const user = sqliteTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: integer('email_verified', { mode: 'boolean' }).notNull(),
  image: text('image'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
})

export const session = sqliteTable('session', {
  id: text('id').primaryKey(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  token: text('token').notNull().unique(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: text('user_id')
    .notNull()
    .references(() => user.id),
  activeOrganizationId: text('active_organization_id'),
  activeTeamId: text('active_team_id'),
})

export const account = sqliteTable('account', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: integer('access_token_expires_at', { mode: 'timestamp' }),
  refreshTokenExpiresAt: integer('refresh_token_expires_at', { mode: 'timestamp' }),
  scope: text('scope'),
  password: text('password'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
})

export const verification = sqliteTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }),
  updatedAt: integer('updated_at', { mode: 'timestamp' }),
})

export const organization = sqliteTable('organization', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').unique(),
  logo: text('logo'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  metadata: text('metadata'),
})

export const member = sqliteTable('member', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id')
    .notNull()
    .references(() => organization.id),
  userId: text('user_id')
    .notNull()
    .references(() => user.id),
  role: text('role').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
})

export const invitation = sqliteTable('invitation', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id')
    .notNull()
    .references(() => organization.id),
  email: text('email').notNull(),
  role: text('role').notNull(),
  status: text('status').notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  inviterId: text('inviter_id')
    .notNull()
    .references(() => user.id),
})

// ─── ShelfMind Application Tables ────────────────────────────────────────────

export const jobs = sqliteTable('jobs', {
  id: text('id').primaryKey(),
  organisationId: text('organisation_id')
    .notNull()
    .references(() => organization.id),
  createdBy: text('created_by')
    .notNull()
    .references(() => user.id),
  status: text('status').default('PENDING'), // PENDING | PROCESSING | COMPLETED | FAILED
  progress: integer('progress').default(0), // 0–100
  imageCount: integer('image_count').default(0),
  // ── Multi-model selection & cost accounting ──────────────────────────────
  visionModel: text('vision_model'), // model id from src/lib/models.ts (null → default)
  inputTokens: integer('input_tokens').default(0), // total prompt tokens across AI calls
  outputTokens: integer('output_tokens').default(0), // total completion tokens
  totalCost: real('total_cost').default(0), // estimated USD cost for the job
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  startedAt: text('started_at'),
  completedAt: text('completed_at'),
  error: text('error'),
}, (table) => ({
  orgIdx: index('idx_jobs_org_id').on(table.organisationId),
  statusIdx: index('idx_jobs_status').on(table.status),
}))

export const imdbRecords = sqliteTable('imdb_records', {
  id: text('id').primaryKey(),
  jobId: text('job_id')
    .notNull()
    .references(() => jobs.id),
  organisationId: text('organisation_id')
    .notNull()
    .references(() => organization.id),

  // ═══════════════════════════════════════════════════════════════════════════
  // 13 IMDB Columns — exact ground-truth order (matches types/imdb.ts)
  // ═══════════════════════════════════════════════════════════════════════════
  ITEM_NAME: text('ITEM_NAME'),
  BARCODE: text('BARCODE'),
  MANUFACTURER: text('MANUFACTURER'),
  BRAND: text('BRAND'),
  WEIGHT: text('WEIGHT'),
  PACKAGING_TYPE: text('PACKAGING_TYPE'), // DB underscore; Excel header = "PACKAGING TYPE"
  COUNTRY: text('COUNTRY'),
  VARIANT: text('VARIANT'),
  TYPE: text('TYPE'),
  FRAGRANCE_FLAVOR: text('FRAGRANCE_FLAVOR'),
  PROMOTION: text('PROMOTION'),
  ADDONS: text('ADDONS'),
  TAGLINE: text('TAGLINE'),

  // ═══════════════════════════════════════════════════════════════════════════
  // Metadata
  // ═══════════════════════════════════════════════════════════════════════════
  confidence: real('confidence'), // 0.0–1.0 weighted
  flagged: integer('flagged', { mode: 'boolean' }).default(false),
  rawExtraction: text('raw_extraction', { mode: 'json' }), // RawExtraction JSON
  fieldMetadata: text('field_metadata', { mode: 'json' }), // Record<ImdbColumnName, FieldMeta>
  productGroupKey: text('product_group_key'), // normalized name tag for grouping

  // ═══════════════════════════════════════════════════════════════════════════
  // Soft-Deletion & Merge Lineage (MDM Auditability)
  // ═══════════════════════════════════════════════════════════════════════════
  status: text('status').default('ACTIVE'), // 'ACTIVE' | 'DELETED'
  mergedIntoId: text('merged_into_id'), // FK → imdb_records.id — surviving parent on merge

  createdAt: text('created_at').default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').default(sql`(datetime('now'))`),
}, (table) => ({
  jobIdx: index('idx_imdb_job_id').on(table.jobId),
  orgIdx: index('idx_imdb_org_id').on(table.organisationId),
  barcodeIdx: index('idx_imdb_barcode').on(table.BARCODE),
  groupKeyIdx: index('idx_imdb_group_key').on(table.productGroupKey),
  orgStatusIdx: index('idx_imdb_org_status').on(table.organisationId, table.status),
  orgStatusCreatedIdx: index('idx_imdb_org_status_created').on(table.organisationId, table.status, table.createdAt),
}))

// ─── Duplicate Pairs (Pre-Calculated Async Detection) ────────────────────────

export const duplicatePairs = sqliteTable('duplicate_pairs', {
  id: text('id').primaryKey(),
  orgId: text('org_id')
    .notNull()
    .references(() => organization.id),
  recordAId: text('record_a_id')
    .notNull()
    .references(() => imdbRecords.id),
  recordBId: text('record_b_id')
    .notNull()
    .references(() => imdbRecords.id),
  similarityScore: real('similarity_score'),
  reason: text('reason'), // 'BARCODE_MATCH' | 'BRAND_WEIGHT_MATCH'
  status: text('status').default('PENDING'), // 'PENDING' | 'DISMISSED' | 'MERGED'
  createdAt: text('created_at').default(sql`(datetime('now'))`),
  resolvedAt: text('resolved_at'),
}, (table) => ({
  orgIdx: index('idx_duplicate_org_id').on(table.orgId),
  recordAIdx: index('idx_duplicate_record_a').on(table.recordAId),
  recordBIdx: index('idx_duplicate_record_b').on(table.recordBId),
  statusIdx: index('idx_duplicate_status').on(table.status),
}))
