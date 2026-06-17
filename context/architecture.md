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
| Image Processing        | Cloudflare Images binding (`env.IMAGES`)          | Background removal (BiRefNet AI) + margin cropping for watermark detection |
| OCR                     | RolmOCR via Fireworks AI (primary) / Google Vision | High-fidelity text transcription from product labels |
| Vision Extraction       | Qwen3-VL via Fireworks AI                         | Maps label text to full 13-column IMDB JSON schema |
| Queue                   | Cloudflare Queues                                 | Background job processing for image batches |
| Observability           | Cloudflare Durable Objects + WebSockets           | Real-time pipeline visualizer state broadcasting |
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
│   │   ├── imdb.ts                   # Canonical 13-column IMDB record type + imageSide + imageTag metadata
│   │   └── pipeline.ts               # Pipeline DAG: initialNodes (8) + initialEdges for React Flow visualizer
│   ├── components/                   # Reusable UI components
│   │   ├── ui/                       # shadcn primitives (button, card, etc.)
│   │   ├── pipeline/
│   │   │   └── CustomNode.tsx        # React Flow custom node renderer for pipeline visualizer
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
│   │   ├── pipeline.ts               # Multi-stage extraction engine: OCR → watermark → BG removal → Qwen → grouping → DB
│   │   ├── watermark-parser.ts       # Deterministic watermark tag parser — extracts auditId, side, product fields
│   │   ├── grouping.ts               # Side-aware, conflict-guarded product grouping engine
│   │   ├── normalization.ts          # Weight format, packaging name, bilingual stripping, and field value normalization
│   │   ├── export.ts                 # ExcelJS predictions.xlsx generator
│   │   ├── query-keys.ts             # Canonical org-scoped TanStack Query key factory
│   │   ├── auth.ts                   # Better Auth server config
│   │   ├── auth-client.ts            # Better Auth client
│   │   └── utils.ts
│   ├── hooks/                        # Custom React hooks
│   │   ├── useImdbRecords.ts         # TanStack Query hook — records with adaptive polling
│   │   ├── usePipelineStream.ts      # TanStack Query + WebSocket hook for visualizer
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
│   │   │   ├── pipeline.tsx          # Real-time React Flow visualizer
│   │   │   ├── review-queue.tsx      # Flagged records review table
│   │   │   ├── review-queue.$recordId.tsx  # Individual record detail
│   │   │   ├── products.tsx          # Cross-job master product repository
│   │   │   ├── duplicates.tsx        # Duplicate pair review queue
│   │   │   └── exports.tsx           # Export center
│   │   └── api/                      # API route handlers (loaders & actions)
│   │       ├── stats.ts              # GET /api/stats — org-scoped aggregate counters
│   │       ├── jobs/                 # Job creation, status, stream proxy, export endpoints
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
├── wrangler.jsonc                    # Cloudflare configuration + bindings (includes IMAGES binding)
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
  ┌─────────────────────────────────────────────────────────────────┐
  │  STAGE 1 — OCR on Original Image (Watermark Detection)          │
  │  • RolmOCR (Fireworks) or Google Vision on raw R2 buffer        │
  │  • Line-by-line scan for physical watermark tag pattern         │
  │  • If not found → multi-margin crop fallback:                   │
  │    bottom → top → left → right edges scanned with OCR           │
  │  • watermarkData: auditId, productDescription, weight, side,     │
  │    manufacturer, country, packaging                              │
  └──────────────────────────┬──────────────────────────────────────┘
                             ↓
  ┌─────────────────────────────────────────────────────────────────┐
  │  STAGE 2 — Background Removal (env.IMAGES)                      │
  │  • Original buffer → Cloudflare Images BiRefNet segmentation    │
  │    segment: "foreground", background: "white", format: "jpeg"   │
  │  • cleanBuffer = product isolated on white background           │
  │  • Second OCR pass on cleanBuffer → richer text wins            │
  │  • Graceful fallback: cleanBuffer = buffer if binding unavail.  │
  └──────────────────────────┬──────────────────────────────────────┘
                             ↓
  ┌─────────────────────────────────────────────────────────────────┐
  │  STAGE 3 — Qwen3-VL Extraction (Cognition)                      │
  │  • cleanBuffer + OCR text → Qwen3-VL via Fireworks AI           │
  │  • Maps clean product label to 13-column IMDB JSON schema       │
  │  • Watermark tag overrides applied on top of Qwen output        │
  │  • imageSide attached from watermarkData.side                   │
  │  • imageSide fallback: detected from Qwen's imageTag suffix     │
  └──────────────────────────┬──────────────────────────────────────┘
                             ↓
  ┌─────────────────────────────────────────────────────────────────┐
  │  STAGE 4 — Side-Aware Grouping & Aggregation                    │
  │  • Product grouping by imageTag (watermark) > BARCODE > Name    │
  │  • hasBrandConflict + hasBarcodeConflict guards                 │
  │  • Side-Label Intelligence: confidence boost by imageSide       │
  │    Front: +0.10 on ITEM_NAME/BRAND/WEIGHT/VARIANT/TAGLINE       │
  │    Back:  +0.10 on MANUFACTURER/COUNTRY/ADDONS/PROMOTION        │
  │    Barcode: +0.15 on BARCODE                                    │
  │  • Weight/Volume blocker prevents multi-size merges             │
  │  • normalization.ts standardizes all outputs                    │
  └──────────────────────────┬──────────────────────────────────────┘
                             ↓
D1: Write to `jobs` + `imdb_records` (13 columns, status='ACTIVE')
                             ↓
  ┌─────────────────────────────────────────────────────────────────┐
  │  STAGE 5 — Post-Job Duplicate Detection                         │
  │  • Query existing ACTIVE records for same org                   │
  │  • Compare by barcode match                                     │
  │  • Compare by normalized brand + weight similarity              │
  │  • Insert matches into `duplicate_pairs` (PENDING)              │
  └──────────────────────────┬──────────────────────────────────────┘
                             ↓
TanStack Query adaptive polling detects completion → ImdbTable re-renders
```

### Pipeline Visualizer — 8 Nodes

The React Flow visualizer (`/pipeline`) streams live state from the `JobCoordinator` Durable Object via WebSockets. Node IDs, edge IDs, and positions are defined in `src/types/pipeline.ts`:

```text
[upload] → e1 → [ocr] → e_ocr → [watermark] → e_watermark_bg → [bgremoval] → e_bg_structured → [structured] → e2 → [grouping] → e3 → [database] → e4 → [deduplication]
```

| Node ID | Title | Badge |
|---|---|---|
| `upload` | Image Ingestion | — |
| `ocr` | RolmOCR Transcription | REDUCTO |
| `watermark` | Watermark Parsing | RULES |
| `bgremoval` | BG Removal | AI |
| `structured` | Qwen3-VL Extraction | — |
| `grouping` | Map-based Grouping | — |
| `database` | Database Write | — |
| `deduplication` | Merge Suggestions | — |

Each node transitions: `pending → active → completed` (or `failed`). Edges light up green when the source node completes.

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

Grouping in `lib/grouping.ts` uses a strict signal hierarchy to prevent distinct SKUs from merging:

1. **Watermark imageTag (deterministic):** If a physical watermark was found, the tag is the primary group key — overrides everything else.
2. **Barcode (1.0):** Definitive exact match when no watermark.
3. **hasBrandConflict guard:** If two extractions have different normalized brands, they are **never** merged regardless of other signals.
4. **hasBarcodeConflict guard:** If two extractions have different barcodes (Levenshtein distance > 2), they are **never** merged.
5. **Weight/Volume blocker:** Identical product names with different weights are forced into separate groups.
6. **Name/visual fallback:** Used only when no watermark, barcode, or conflict guard applies.

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
| `raw_extraction` | TEXT (JSON) | Full audit trail — OCR + Vision per image + watermark data |
| `field_metadata` | TEXT (JSON) | Per-field `{ value, source, confidence }` |
| `product_group_key` | TEXT | Normalized grouping tag (from watermark imageTag or barcode) |
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

### Cloudflare Images Binding — Background Removal & Margin Crops

The `env.IMAGES` binding is used for two distinct purposes in `lib/pipeline.ts`:

**1. Watermark margin cropping** (`cropImageMargin`) — uses the original buffer to isolate edge strips for watermark tag OCR:
```ts
const options: any = { fit: "crop" };
// bottom: gravity { x: 0.5, y: 0.95 }, width: 1600, height: 240
// top:    gravity { x: 0.5, y: 0.05 }, width: 1600, height: 240
// left:   gravity { x: 0.05, y: 0.5 }, width: 240,  height: 1600
// right:  gravity { x: 0.95, y: 0.5 }, width: 240,  height: 1600
const transformed = env.IMAGES.transform(new Response(buffer), options);
const croppedBuffer = await transformed.arrayBuffer();
```

**2. Background removal** (`removeBackground`) — called AFTER watermark extraction (edges preserved), returns `cleanBuffer` for OCR and Qwen:
```ts
const transformed = env.IMAGES.transform(new Response(buffer), {
    segment: "foreground",
    background: "white", // white = maximum OCR contrast for dark label text
    format: "jpeg",
    quality: 95,
});
const cleanBuffer = await transformed.arrayBuffer();
// Graceful fallback: if binding unavailable or transform fails → returns original buffer
```

### Bindings & Dev/Prod Parity

All Cloudflare services (R2, KV, Queues, D1, IMAGES) are accessed through a unified environment wrapper in `lib/`. The detection pattern is consistent:

```ts
// Binding present = production. Absent = local mock.
if (env.IMAGES) {
    const cleanBuffer = await removeBackground(buffer, env);  // CF Images AI
} else {
    const cleanBuffer = buffer; // passthrough in local dev
}
```

### Stateful Observability (Durable Objects)

The extraction engine (`lib/pipeline.ts`) makes non-blocking RPC calls to the `JobCoordinator` Durable Object during execution. The DO broadcasts these updates (`node_update`, `log`, `edge_update`) down a WebSocket to the Pipeline Visualizer UI.

**Important distinction:** The Durable Object is strictly an *ephemeral broadcaster*. It does not store final state. D1 remains the single source of truth.

```ts
// pipeline.ts emitting updates
await reporter.updateNodeState("bgremoval", "active")
await reporter.addLog("bgremoval", `[${fileName}] Product isolated from shelf background`, "success")
await reporter.updateNodeState("bgremoval", "completed")
await reporter.updateEdgeState("e_watermark_bg", true, "#10b981")

// JobCoordinator.ts broadcasting
this.broadcast({ type: 'log', nodeId, log: { ... } })
```

### Queue Pattern

```ts
// Producer (routes/api/jobs/)
await env.IMAGE_QUEUE.send({ jobId, imageKeys })

// Consumer (entry.worker.ts → lib/pipeline.ts)
export default {
  async queue(batch: MessageBatch, env: Env) {
    for (const msg of batch.messages) {
      await processJob(msg.body, env)
      msg.ack()
    }
  }
}
```

### Watermark Parser (`lib/watermark-parser.ts`)

The watermark parser is the deterministic ground truth layer. It uses regex to extract structured fields from a printed tag that appears on every audit photo:

```ts
interface WatermarkData {
    auditId: string;          // e.g. "AUD-2024-001"
    productDescription?: string; // product name (side word stripped)
    weight?: string;
    side?: string;            // "Front" | "Back" | "Left" | "Right" | "Barcode" | "Top" | "Bottom"
    manufacturer?: string;
    country?: string;
    packaging?: string;
}
```

The `side` field feeds directly into Side-Label Intelligence in `lib/grouping.ts`.

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

3. The `merged_into_id` column creates a **directed graph of record lineage** — any soft-deleted record can be traced back to its surviving parent in a single indexed lookup.

---

## Key Invariants & Rules

* Always produce **exactly 13 columns** in the order defined in `types/imdb.ts`.
* One record per **product** (never per image) — grouping via `pipeline.ts`.
* **Watermark Rule:** Physical watermark tag values always override Qwen3-VL values for ITEM_NAME, WEIGHT, MANUFACTURER, COUNTRY, PACKAGING_TYPE, and imageTag grouping key.
* **Background Removal Order:** `removeBackground()` is always called AFTER `cropImageMargin()` — the original buffer edges must be intact for watermark detection.
* **Grouping Rule:** `hasBrandConflict` and `hasBarcodeConflict` are hard blockers — records with conflicting brands or barcodes are **never** merged regardless of other signals. Weight/Volume is a strict secondary blocker.
* **Side Boost Rule:** Side-label confidence boosts (+0.10/+0.15) are transient — they influence merge priority only, never written to D1.
* **Normalization Rule:** `lib/normalization.ts` must contain regex logic adapted for local market standards (e.g., stripping secondary French text in West African packaging, cleaning localized promo bands).
* **Soft-Deletion Rule:** Records are never hard-deleted. `status = 'ACTIVE'` is the visibility filter. Merged records carry `merged_into_id` for lineage.
* **Duplicate Detection Rule:** Duplicates are detected asynchronously at the end of each pipeline job and stored in `duplicate_pairs`. Never computed on the fly at the API layer.
* Leave fields empty (`""`) if confidence is low — never hallucinate values.
* All AI calls (OCR + Qwen) are made exclusively from `lib/pipeline.ts`.
* Every job has a full audit trail (`rawExtraction`, `fieldMetadata`, watermark data per image).
* Protected routes require a valid Better Auth session + org context.
* **No business logic in components or route files** — delegate everything to `lib/`.
* All exports must produce `predictions.xlsx` matching the ground truth format exactly.
* All exports only include records with `status = 'ACTIVE'`.
* All client data fetching goes through **TanStack Query** hooks — no raw `fetch` in components.
* All query keys must use the org-scoped factory in `lib/query-keys.ts`.

---

## Architecture Evaluation

> Last reviewed: 2026-06-17

### Performance Analysis

| Stage | Speed | Notes |
| --- | --- | --- |
| Watermark OCR (full image) | ~800ms/image | RolmOCR via Fireworks API |
| Watermark margin crop fallback | ~200ms/edge × 4 | Only triggers if no tag in full OCR |
| Background removal (CF Images) | ~100–300ms/image | BiRefNet via Cloudflare edge — runs on the same edge as the Worker |
| Clean OCR pass | ~800ms/image | Only if cleanBuffer differs from original; skipped otherwise |
| Qwen3-VL extraction | ~2–4s/image | Heavy inference via Fireworks API |
| KV caching (7-day TTL) | Near-instant | Second+ runs on same images skip AI entirely |
| Side-aware grouping | Negligible | In-memory map operations |
| Post-job duplicate detection | <500ms | Simple indexed D1 queries against existing records |
| Duplicate pair UI load | <50ms | Pre-calculated `SELECT ... WHERE status='PENDING'` |
| TanStack Query cache | Instant | Repeated navigations within staleTime skip API |
| Session check (cached) | Instant | DB hit at most once per 5-minute window |

**Primary bottleneck:** First run across all images (~6–10 minutes total for a 20-image batch). Subsequent cached runs are very fast. The background removal + clean OCR pass adds ~1–1.5s per image but eliminates cross-product field contamination.