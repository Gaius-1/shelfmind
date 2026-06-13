# Architecture

## Stack

| Layer                   | Tool                                              | Purpose |
|-------------------------|---------------------------------------------------|---------|
| Framework               | TanStack Start (Vite + React)                     | Full-stack routing, SSR/SSG, and modern React development |
| Routing                 | TanStack Router                                   | File-based routing, layouts, loaders, and actions |
| Data Fetching & Caching | TanStack Query                                    | Server-state management, optimistic updates, background refetching |
| State Management        | TanStack Store                                    | Lightweight, reactive client-side global state |
| Data Tables             | TanStack Table                                    | Sortable, filterable IMDB records table with column visibility |
| Forms                   | TanStack Form                                     | Type-safe forms with Zod validation for uploads and settings |
| Authentication          | Better Auth                                       | Secure auth (email, OAuth, sessions) — server & client support |
| Database                | Drizzle ORM + SQLite (local) / D1 (prod)          | Type-safe schema & migrations |
| Storage                 | Cloudflare R2                                     | Image uploads and export files |
| Preprocessing           | Cloudflare Image Resizing (`cf.image`)            | WebP conversion, downscaling, edge sharpening |
| AI / Vision             | Cloudflare Workers AI (Qwen2.5-VL)                | OCR, structured extraction, barcode fallback |
| Queue                   | Cloudflare Queues                                 | Background job processing for image batches |
| Caching                 | Cloudflare KV                                     | Extraction result caching (7-day TTL) |
| UI                      | shadcn/ui + Tailwind CSS                          | High-quality, accessible components |
| Language                | TypeScript (strict)                               | End-to-end type safety |
| Deployment              | Cloudflare Workers + Pages                        | Edge deployment with full bindings support |
| Local Dev               | Bun + Vite + Wrangler mocks                       | Seamless dev/prod parity |

---

## Folder Structure

```bash
shelfmind/
├── context/                          # Project documentation
│   ├── project-overview.md
│   ├── architecture.md               # ← This file
│   ├── ui-tokens.md
│   ├── code-standards.md
│   └── build-plan.md
├── public/                           # Static assets
│   ├── logo.png
│   └── ...
├── src/
│   ├── types/                        # Shared TypeScript type definitions
│   │   └── imdb.ts                   # Canonical 13-column IMDB record type + field metadata
│   ├── components/                   # Reusable UI components
│   │   ├── ui/                       # shadcn primitives (button, card, etc.)
│   │   ├── dashboard/
│   │   │   ├── ImdbTable.tsx         # TanStack Table — sortable, filterable records view
│   │   │   ├── JobList.tsx           # Job status list with TanStack Query polling
│   │   │   ├── UploadForm.tsx        # TanStack Form — image upload with Zod validation
│   │   │   ├── RecordDetail.tsx      # Single record deep-dive with evidence tabs
│   │   │   ├── DuplicateCard.tsx     # Side-by-side duplicate pair comparison
│   │   │   └── StatsCards.tsx        # Dashboard overview metrics grid
│   │   ├── upload/                   # Image upload, job creation
│   │   └── common/                   # Layout, nav, theme
│   ├── db/                           # Database layer
│   │   ├── schema.ts                 # Drizzle schema (jobs + imdb_records + duplicate_pairs)
│   │   ├── index.ts                  # DB client factory (D1 in prod, SQLite locally)
│   │   └── migrate.ts
│   ├── lib/                          # Core business logic & utilities (no React)
│   │   ├── storage.ts                # R2 wrapper (prod + filesystem mock)
│   │   ├── queue.ts                  # Cloudflare Queue wrapper (prod + setTimeout mock)
│   │   ├── pipeline.ts               # Hybrid extraction engine + Preprocessing + Duplicate detection
│   │   ├── grouping.ts               # Multi-signal product grouping engine
│   │   ├── normalization.ts          # Weight format, packaging name, bilingual stripping, and field value normalization
│   │   ├── export.ts                 # ExcelJS predictions.xlsx generator
│   │   ├── query-keys.ts             # Canonical org-scoped TanStack Query key factory
│   │   ├── auth.ts                   # Better Auth server config
│   │   ├── auth-client.ts            # Better Auth client
│   │   └── utils.ts
│   ├── hooks/                        # Custom React hooks
│   │   ├── useImdbRecords.ts         # TanStack Query hook — records with adaptive polling
│   │   ├── useProducts.ts            # TanStack Query hook — cross-job active records
│   │   ├── useDuplicates.ts          # TanStack Query hook — pending duplicate pairs
│   │   ├── useStats.ts               # TanStack Query hook — dashboard aggregate counters
│   │   ├── useRecordMutation.ts      # TanStack Query mutation — inline record editing
│   │   ├── useDuplicateAction.ts     # TanStack Query mutation — dismiss/merge duplicate pairs
│   │   └── useSession.ts             # TanStack Query hook — cached session (5 min staleTime)
│   ├── routes/                       # TanStack Router routes
│   │   ├── __root.tsx                # Root layout + QueryClient provider + session guard
│   │   ├── index.tsx                 # Landing page
│   │   ├── dashboard.tsx             # Protected dashboard layout
│   │   ├── dashboard/
│   │   │   ├── index.tsx             # Dashboard overview — stats, activity, charts
│   │   │   ├── uploads.tsx           # Batch image upload page
│   │   │   ├── processing-queue.tsx  # Active/historical job tracker
│   │   │   ├── review-queue.tsx      # Flagged records review table
│   │   │   ├── review-queue.$recordId.tsx  # Individual record detail
│   │   │   ├── products.tsx          # Cross-job master product repository
│   │   │   ├── duplicates.tsx        # Duplicate pair review queue
│   │   │   └── exports.tsx           # Export center
│   │   └── api/                      # API route handlers (loaders & actions)
│   │       ├── stats.ts              # GET /api/stats — org-scoped aggregate counters
│   │       ├── jobs/                 # Job creation, status, export endpoints
│   │       ├── products/             # GET /api/products — cross-job active records
│   │       ├── records/              # PATCH /api/records/$recordId — inline field edit
│   │       └── duplicates/           # GET + PATCH /api/duplicates — duplicate pair CRUD
│   └── integrations/
│       ├── tanstack-query/
│       │   └── root-provider.tsx     # QueryClient setup + devtools
│       └── better-auth/
├── drizzle/                          # Generated migrations
├── .wrangler/                        # Local mocks (R2, KV, Queue, AI)
│   ├── mock-r2/                      # Filesystem-based R2 mock
│   ├── mock-cache/                   # JSON-file KV mock
│   └── mock-ai/                      # Per-imageHash fixture JSON files + default.json fallback
├── wrangler.jsonc                    # Cloudflare configuration + bindings
├── drizzle.config.ts
├── vite.config.ts
└── package.json
```

---

## Data Flow

### Image Upload → Processing → Duplicate Detection

```text
User fills UploadForm (TanStack Form + Zod validation)
        ↓
TanStack Router action (routes/api/jobs/)
        ↓
storage.saveUpload() → R2 (or mock filesystem)
        ↓
queue.dispatchJob() → Cloudflare Queue (or in-memory setTimeout)
        ↓
TanStack Query optimistic update → UI reflects 'processing' immediately
        ↓
Worker / background processor
        ↓
processJob() in pipeline.ts
        ↓
  ┌─────────────────────────────────────────────────────┐
  │  PHASE 1 — Edge Preprocessing (Native)              │
  │  Worker fetches image from R2 with cf.image:        │
  │  • Downscale width (e.g. 1200px)                    │
  │  • Convert to WebP                                  │
  │  • Apply sharpen=1.5 (Restores OCR text edges)      │
  │  [Bypassed in local dev — raw buffer used directly] │
  └─────────────────┬───────────────────────────────────┘
                    ↓
  ┌─────────────────────────────────────────────────────┐
  │  PHASE 2 — Parallel Extraction                      │
  │  • ZXing barcode per image                          │
  │  • Qwen2.5-VL structured extraction + OCR           │
  │  [Workers AI results KV-cached by imageHash]        │
  └─────────────────┬───────────────────────────────────┘
                    ↓
  ┌─────────────────────────────────────────────────────┐
  │  PHASE 3 — Grouping & Aggregation                   │
  │  • Product grouping via Barcode > Weight > Name Tag │
  │  • Weight/Volume blocker prevents multi-size merges │
  │  • Multi-image field aggregation                    │
  │  • Weighted confidence engine calculates best field │
  │  • normalization.ts standardizes outputs            │
  │  • Bilingual text stripping (e.g. EN/FR labels)     │
  └─────────────────┬───────────────────────────────────┘
                    ↓
D1: Write to `jobs` + `imdb_records` (13 columns, status='ACTIVE')
                    ↓
  ┌─────────────────────────────────────────────────────┐
  │  PHASE 4 — Post-Job Duplicate Detection             │
  │  • Query existing ACTIVE records for same org       │
  │  • Compare by barcode match                         │
  │  • Compare by normalized brand + weight similarity  │
  │  • Insert matches into `duplicate_pairs` (PENDING)  │
  └─────────────────┬───────────────────────────────────┘
                    ↓
TanStack Query adaptive polling detects completion → ImdbTable re-renders
```

### Duplicate Resolution Flow

```text
User navigates to /duplicates
        ↓
GET /api/duplicates → SELECT * FROM duplicate_pairs WHERE org_id = ? AND status = 'PENDING'
        ↓
UI renders DuplicateCard components (side-by-side comparison)
        ↓
User action:
  ├── DISMISS → PATCH /api/duplicates/$pairId { action: 'DISMISS' }
  │             → pair.status = 'DISMISSED'
  │             → Both records remain ACTIVE
  │
  └── MERGE   → PATCH /api/duplicates/$pairId { action: 'MERGE' }
               → Record B: status = 'DELETED', merged_into_id = Record A's ID
               → Record A: enriched with any missing fields from B
               → pair.status = 'MERGED'
               → Full lineage preserved — Record B traces back to Record A
```

### Grouping Engine Signals & Priority

To prevent distinct SKUs of varying sizes from incorrectly merging, grouping utilizes a strict signal hierarchy inside `lib/grouping.ts`:

1. **Barcode (1.0):** Definitive exact match.
2. **Weight/Volume (0.95):** Acts as a strict blocker. If `product_name` and `visual_similarity` match perfectly, but one is extracted as `400g` and the other as `800g`, the engine forces them into separate groups.
3. **Name Tag OCR (0.85):** Strong linguistic indicator.
4. **Visual Similarity (0.65):** Structural indicator via VLM.
5. **Filename/Folder (0.40):** Weak operational hint.

---

## Database Schema

### `imdb_records` Table

| Column | Type | Notes |
|--------|------|-------|
| `id` | TEXT PK | UUID |
| `job_id` | TEXT FK → jobs | Source job |
| `organisation_id` | TEXT FK → organization | Org scope |
| `ITEM_NAME` through `TAGLINE` | TEXT | 13 IMDB columns |
| `confidence` | REAL | 0.0–1.0 weighted mean |
| `flagged` | INTEGER (boolean) | `true` if confidence < 0.75 |
| `raw_extraction` | TEXT (JSON) | Full audit trail — ZXing + OCR + Vision per image |
| `field_metadata` | TEXT (JSON) | Per-field `{ value, source, confidence }` |
| `product_group_key` | TEXT | Normalized grouping tag |
| `status` | TEXT | `'ACTIVE'` (default) \| `'DELETED'` |
| `merged_into_id` | TEXT (nullable) | FK → imdb_records.id — surviving parent on merge |
| `created_at` | TEXT | ISO timestamp |
| `updated_at` | TEXT | ISO timestamp |

### `duplicate_pairs` Table

| Column | Type | Notes |
|--------|------|-------|
| `id` | TEXT PK | UUID |
| `org_id` | TEXT FK → organization | Org scope |
| `record_a_id` | TEXT FK → imdb_records | First record (survives on merge) |
| `record_b_id` | TEXT FK → imdb_records | Second record (soft-deleted on merge) |
| `similarity_score` | REAL | 0.0–1.0 |
| `reason` | TEXT | `'BARCODE_MATCH'` \| `'BRAND_WEIGHT_MATCH'` |
| `status` | TEXT | `'PENDING'` (default) \| `'DISMISSED'` \| `'MERGED'` |
| `created_at` | TEXT | ISO timestamp |
| `resolved_at` | TEXT (nullable) | Set when dismissed or merged |

---

## Cloudflare-Native Patterns

### Native Image Preprocessing (`cf.image`)

Instead of routing to external vendors like Cloudinary, images are pulled from R2 and dynamically optimized in the background queue worker prior to inference. This drastically reduces Workers AI execute time and improves OCR accuracy. In local development, `cf.image` is bypassed and raw buffers are used directly.

```ts
// Production — Edge preprocessing
const response = await fetch(`https://internal-r2/${imageKey}`, {
  cf: { image: { width: 1200, format: 'webp', quality: 85, sharpen: 1.5 } }
});

// Local dev — Bypass
const buffer = await getUpload(orgId, jobId, fileName); // raw buffer
```

### Bindings & Dev/Prod Parity

All Cloudflare services (AI, R2, KV, Queues, D1) are accessed through a unified environment wrapper in `lib/`. The detection pattern is consistent across all services:

```ts
// Binding present = production. Absent = local mock. Pattern used everywhere in lib/.
if (env.PRODUCT_IMAGES) {
  await env.PRODUCT_IMAGES.put(key, data)              // R2 production
} else {
  await fs.writeFile(`.wrangler/mock-r2/${key}`, ...)  // filesystem mock
}
```

### Queue Pattern

```ts
// Producer (routes/api/jobs/)
await env.IMAGE_QUEUE.send({ jobId, imageKeys })

// Consumer (background worker → lib/pipeline.ts)
export default {
  async queue(batch: MessageBatch, env: Env) {
    for (const msg of batch.messages) {
      await processJob(msg.body, env)
      msg.ack()
    }
  }
}
```

### AI Calls — KV-Cached

Workers AI is called exclusively from `lib/pipeline.ts`. All calls are KV-cached before writing to D1. The cache key includes `orgId`, `imageHash`, and `promptType` so prompt changes naturally bust the cache.

```ts
const cacheKey = `extraction:${orgId}:${hash}:${promptType}`
const cached = await env.CACHE.get(cacheKey)
if (cached) return JSON.parse(cached)

const result = await env.AI.run('@cf/qwen/qwen2.5-vl-7b-instruct', { ... })
await env.CACHE.put(cacheKey, JSON.stringify(result), { expirationTtl: 604_800 })
return result
```

---

## Soft-Deletion & Merge Lineage

ShelfMind follows **Master Data Management (MDM) best practices** — records are never hard-deleted. This guarantees full auditability and traceability.

### How It Works

1. When a user merges duplicate pair (Record A + Record B):
   - Record B's `status` is set to `'DELETED'`
   - Record B's `merged_into_id` is set to Record A's `id`
   - Record A is enriched with any fields from B that had higher confidence or were previously empty
   - The `duplicate_pairs` row's status is set to `'MERGED'`

2. All repository, export, and stats queries filter on `status = 'ACTIVE'`:
   ```ts
   .where(eq(imdbRecords.status, 'ACTIVE'))
   ```

3. The `merged_into_id` column creates a **directed graph of record lineage** — any soft-deleted record can be traced back to its surviving parent in a single indexed lookup. If a catalogue manager questions why a barcode disappeared from the repository, the answer is one query away.

---

## Key Invariants & Rules

* Always produce **exactly 13 columns** in the order defined in `types/imdb.ts`.
* One record per **product** (never per image) — grouping via `pipeline.ts`.
* **Grouping Rule:** `Weight/Volume` is a critical grouping signal; identical products with different weights must never group into the same IMDB record.
* **Normalization Rule:** `lib/normalization.ts` must contain regex logic adapted for local market standards (e.g., stripping secondary French text in West African packaging, cleaning localized promo bands).
* **Soft-Deletion Rule:** Records are never hard-deleted. `status = 'ACTIVE'` is the visibility filter. Merged records carry `merged_into_id` for lineage.
* **Duplicate Detection Rule:** Duplicates are detected asynchronously at the end of each pipeline job and stored in `duplicate_pairs`. Never computed on the fly at the API layer.
* Leave fields empty (`""`) if confidence is low — never hallucinate values.
* Barcode from ZXing always takes precedence (`weight: 1.0`).
* All AI calls are KV-cached and use few-shot structured JSON prompts directed solely to Qwen2.5-VL.
* Every job has a full audit trail (`rawExtraction`, `fieldMetadata`).
* Protected routes require a valid Better Auth session + org context.
* **No business logic in components or route files** — delegate everything to `lib/`.
* All exports must produce `predictions.xlsx` matching the ground truth format exactly.
* All exports only include records with `status = 'ACTIVE'`.
* All client data fetching goes through **TanStack Query** hooks — no raw `fetch` in components.
* All query keys must use the org-scoped factory in `lib/query-keys.ts`.

---

## Architecture Evaluation

> Last reviewed: 2026-06-12

### Performance Analysis

| Stage | Speed | Notes |
| --- | --- | --- |
| Native Image Preprocessing | <50ms/image | Downscales and sharpens at edge via `cf.image` |
| ZXing barcode | <100ms/image | Pure WASM, extremely fast |
| Workers AI Vision (Qwen2.5-VL) | ~2–4s/image | Heavy inference, isolated via concurrent Promise.all |
| KV caching (7-day TTL) | Near-instant | Second+ runs on same images skip AI entirely |
| Post-job duplicate detection | <500ms | Simple indexed D1 queries against existing records |
| Duplicate pair UI load | <50ms | Pre-calculated `SELECT ... WHERE status='PENDING'` |
| TanStack Query cache | Instant | Repeated navigations within staleTime skip API |
| Session check (cached) | Instant | DB hit at most once per 5-minute window |
| Multi-image grouping | Negligible | Cheap once text/visual signals are detected |
| Local dev with mocks | Fast | No real AI calls, no costs |

**Primary bottleneck:** First run across all images (~5–8 minutes total). Subsequent cached runs are very fast. Demo will feel responsive.