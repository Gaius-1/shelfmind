# Project Overview

## About the Project

ShelfMind is a full-stack AI-powered image-to-item master data tool built for retail teams at the GDSS-Maverick Hackathon. A field agent photographs a product, uploads it through the web interface, and ShelfMind's hybrid extraction pipeline automatically reads the image using a multi-stage approach — deterministic watermark tag parsing, AI background removal, OCR transcription (RolmOCR via Fireworks AI or Google Vision), and vision AI classification (Qwen3-VL via Fireworks AI) — to fill all 13 Item Master Database (IMDB) columns with per-field confidence scores. The user reviews the extracted records, edits any flagged fields, and exports a clean Excel or CSV file ready for database upload.

ShelfMind is built as a multi-tenant SaaS. Each organisation has its own isolated workspace — members, jobs, IMDB records, and exports are all scoped to an organisation. Users can belong to multiple organisations and switch between them from the workspace switcher in the top-right of the app shell.

Every step runs entirely on Cloudflare's infrastructure: Workers handle the API, Queues handle async processing, R2 stores images and exports, D1 stores structured records, KV caches AI results, and Durable Objects provide real-time stateful observability via WebSockets. Authentication and multi-tenancy are handled by better-auth with the organisation plugin.

---

## The Problem It Solves

Retail teams fill the Item Master Database manually by transcribing data from product images and labels. This causes inconsistencies, duplicated entries, and slow cataloging — especially for field teams working across hundreds of SKUs. A product that takes a human 5–10 minutes to research and enter manually takes ShelfMind under 30 seconds.

ShelfMind eliminates that manual transcription work entirely. The pipeline strips the shelf background from every image before running OCR — so neighbor products on the shelf no longer corrupt the extraction. A physical watermark tag printed on each audit photo provides a deterministic audit identity and product description override, anchoring the grouping logic to ground truth rather than AI inference. Qwen3-VL then reads the clean, isolated product surface and maps the label text to the full 13-column IMDB schema. The user just reviews, edits any flagged fields, and exports.

---

## Pages

```text
/                             → Homepage
/login                        → Auth page (email + Google OAuth)
/signup                       → Sign up page
/dashboard                    → Workspace overview, recent activity, analytics
/uploads                      → Batch image upload and job submission
/processing-queue             → Live job status and per-image extraction progress
/pipeline                     → Real-time React Flow visualizer streaming from the Durable Object
/review-queue                 → IMDB record review, inline editing, duplicate flags
/review-queue/[recordId]      → Individual product record detail and edit page
/product-repository           → Full searchable IMDB record table across all jobs
/duplicates                   → Detected duplicate pairs across the workspace
/export-center                → Export settings, download, database import guide
/settings                     → Organisation settings, member management, billing
/settings/profile             → User profile and notification preferences
```

---

## Navigation

Persistent left sidebar. Grouped into four sections with a collapsible toggle. Workspace switcher and user menu in the app shell footer and top-right.

```text
OVERVIEW
  Dashboard

PROCESSING
  Uploads
  Processing Queue
  Pipeline Visualizer
  Review Queue

DATA
  Product Repository
  Duplicates

EXPORTS
  Export Center
```

Breadcrumb trail in the top bar reflects the current page. No separate top navbar for page links.

---

## Authentication — better-auth

Authentication is handled entirely by **better-auth** with the following plugins active:

* **`organisation`** — multi-tenancy with organisation creation, invitations, member roles, and active organisation context
* **`emailAndPassword`** — email + password sign-up and sign-in with email verification
* **`socialProviders` (Google)** — Google OAuth sign-in

### Auth Flow

* User signs up via email + password or Google OAuth
* On first login with no organisation membership → redirect to organisation creation screen
* User creates or is invited to an organisation → becomes the Owner
* Active organisation is stored in the session; all data queries are scoped to it
* Switching organisations updates the active org in the session → all queries re-scope automatically
* Workspace switcher in the top-right shows all orgs the user belongs to

### Roles

better-auth organisation plugin provides three roles out of the box:

```text
owner   → full access; can delete organisation, manage billing
admin   → can invite members, manage jobs and exports
member  → can upload, review, and export within the organisation
```

### Session

* Session is managed by better-auth; stored as a signed cookie
* Active organisation ID is part of the session payload
* All Workers API routes read `organisationId` from the session — never from the request body or query params

### Invitation Flow

* Owner or admin sends an invite by email from `/settings`
* better-auth generates a signed invitation token and sends an email
* Recipient clicks the link → lands on `/accept-invite/[token]` → joins the organisation with the `member` role
* Pending invitations visible in `/settings` with revoke option

---

## Core User Flow

### Homepage

* Hero section explaining the upload → extract → export flow
* Logged-in users → redirect to `/dashboard`
* Logged-out users → redirect to `/login`

### Onboarding

* User signs up and creates their first organisation
* On first login → redirect to `/dashboard`
* Dashboard shows an incomplete setup banner if the organisation has no jobs yet
* After setup → user goes to Uploads to submit their first batch

### Uploads

* User selects or drags product images onto the upload zone
* Up to 20 images per batch; JPG, PNG, WEBP supported
* Each image gets a thumbnail preview with a "Pending" badge
* User clicks **Start Extraction** to submit the batch
* Worker API receives images, stores them in R2 under `uploads/{orgId}/{jobId}/`, creates a job record in D1 (`PENDING`), and pushes a message to Cloudflare Queues
* API immediately returns `{ jobId }` — frontend routes to `/processing-queue`

### Processing Queue

* Lists all jobs for the active organisation, most recent first
* Each job row shows: batch name, image count, status pill, progress bar, started time
* Live polling on `PENDING` and `PROCESSING` jobs via `GET /jobs/:jobId`
* Poll hits KV cache first; falls back to D1
* Job statuses: PENDING → PROCESSING → COMPLETED / FAILED
* Clicking an active job → routes to the Pipeline Visualizer to watch the execution live
* Clicking a completed job → routes to Review Queue filtered to that job

### Extraction Pipeline — Multi-Stage Approach

The pipeline is a sequential, multi-stage process that runs in a Cloudflare Queue consumer. For each image in the batch:

**Stage 1 — OCR on Original Image (Watermark Detection)**
* The raw R2 buffer is base64-encoded and sent to RolmOCR (via Fireworks AI) or Google Vision
* The full-image OCR text is scanned line-by-line for a physical watermark tag pattern (e.g. `AUD-2024-001 Coca-Cola Classic 330ml`)
* If no watermark is found, the pipeline performs a **multi-margin crop fallback** — it systematically crops and re-OCRs all four edges (bottom → top → left → right) of the original buffer until the tag is located
* The watermark tag, if found, provides a deterministic `auditId`, `productDescription`, `weight`, `side` (Front/Back/Left/Right/Barcode), `manufacturer`, `country`, and `packaging` — all of which override Qwen3-VL's extracted values for those fields

**Stage 2 — Background Removal**
* After watermark extraction (which requires the original edges to be intact), the original buffer is passed to `removeBackground()` via the Cloudflare Images binding (`env.IMAGES`)
* Cloudflare Images applies BiRefNet AI segmentation: `segment: "foreground"`, `background: "white"`, `format: "jpeg"`, `quality: 95`
* The result is a `cleanBuffer` — the product isolated on a clean white background, with all shelf/store noise stripped
* If the binding is unavailable or the transform fails, `cleanBuffer` gracefully falls back to the original buffer
* A second OCR pass is run on `cleanBuffer` — if it returns richer text than the first pass, it replaces the original OCR for field extraction

**Stage 3 — Qwen3-VL Extraction (Cognition)**
* `cleanBuffer` (background-removed image) is sent to Qwen3-VL via Fireworks AI
* Qwen maps the clean product label text to the full 13-column IMDB JSON schema
* Watermark tag overrides are then applied on top of Qwen's output for maximum accuracy

**Stage 4 — Grouping & Aggregation**
* All per-image extractions are grouped by `imageTag` (from the watermark) or `BARCODE`
* Grouping uses strict brand conflict and barcode conflict guards to prevent cross-contamination between distinct products
* **Side-Label Intelligence:** Each extraction carries an `imageSide` field (Front/Back/Left/Right/Barcode/Top/Bottom) parsed from the watermark tag suffix. During field aggregation, the grouping engine applies a confidence boost (+0.10 for Front/Back on their canonical fields, +0.15 for Barcode on the `BARCODE` field) — Front images win ITEM_NAME/BRAND/WEIGHT/VARIANT/TAGLINE, Back images win MANUFACTURER/COUNTRY/ADDONS/PROMOTION
* The normalization layer (`lib/normalization.ts`) standardizes weight formats, strips secondary languages (e.g., dual English/French labels common in West Africa), and normalizes packaging names

**Stage 5 — Database Write**
* Merged records are written to `imdb_records` in D1, scoped to `organisation_id`

**Stage 6 — Post-Job Duplicate Detection**
* After all records are written, the pipeline compares new records against existing `ACTIVE` records for the same org by barcode match and normalized brand+weight similarity
* Matching pairs are inserted into `duplicate_pairs` with `status = 'PENDING'` for human review

**Observability:** As each stage runs, the pipeline emits non-blocking RPC events to the `JobCoordinator` Durable Object, which broadcasts live state via WebSockets to the Pipeline Visualizer. The visualizer shows 8 nodes: Image Ingestion → RolmOCR → Watermark Parsing → BG Removal → Qwen3-VL Extraction → Map-based Grouping → Database Write → Merge Suggestions.

### Review Queue

* Lists all IMDB records for the active organisation, filterable by job, confidence, and flagged status
* Summary metric bar: total products, high-confidence count, flagged count, average confidence
* Full paginated IMDB table: all 13 columns visible, confidence bar per row, "Needs Review" badge on flagged rows
* Filter dropdown: All Records / High Confidence / Needs Review
* Sort by: Confidence / Date Added / Brand
* Click any row → opens `/review-queue/[recordId]` individual record detail page
* After review, user proceeds to Export Center

### Individual Record Page — `/review-queue/[recordId]`

* All 13 IMDB columns displayed as editable fields: item name, barcode, manufacturer, brand, weight, packaging type, country, variant, type, fragrance/flavor, promotion, addons, tagline
* Per-field confidence section:
  * Confidence score and source (`ZXing`, `OCR`, `Vision AI`, or `Merged`) displayed beside each field
  * Low-confidence fields highlighted in amber; missing fields highlighted in red
* Extraction evidence panel:
  * Raw ZXing barcode result
  * Raw OCR text output
  * Vision AI structured JSON response
* Save Changes button — writes edits to D1, sets edited field confidence to `1.0` with source `'Merged'`, and recalculates overall record confidence
* Back to Review Queue button

### Product Repository

* Full searchable and filterable table of all **active** IMDB records across all jobs for the active organisation
* Search by product name, brand, barcode, or manufacturer
* Filter by category, packaging type, country of origin
* Not job-scoped — this is the clean master view of everything extracted and reviewed
* Only shows records with `status = 'ACTIVE'` — soft-deleted (merged) records are excluded

### Duplicates

* Lists all detected duplicate pairs with `status = 'PENDING'` for the active organisation
* Duplicate pairs are **pre-calculated asynchronously** at the end of each pipeline job and stored in the `duplicate_pairs` table — the UI reads from this table (millisecond queries)
* Each pair shows: both product names, similarity score, match reason (`BARCODE_MATCH` or `BRAND_WEIGHT_MATCH`)
* Actions per pair:
  * **Dismiss** — marks the pair as `'DISMISSED'` (false positive); both records remain active
  * **Merge** — soft-deletes Record B (`status = 'DELETED'`, `merged_into_id = recordA.id`), enriches Record A with any missing fields from B, sets pair status to `'MERGED'`
* Resolved pairs (dismissed/merged) are hidden from the default view but accessible via a filter toggle

### Export Center

* Format picker: Excel (.xlsx) via ExcelJS, CSV, or JSON
* Scope filter: All Records / High Confidence Only / Flagged for Review / Specific Job
* Only exports records with `status = 'ACTIVE'` — soft-deleted records are never included in exports
* Download button — ExcelJS reads from D1 scoped to `organisation_id` and writes the file to R2; signed download URL returned to frontend
* Export history: list of previous exports with download links, scoped to the active organisation
* Database import guide (inline panel) explaining column mapping for common systems

### Dashboard

* Stats bar — 5 cards: Total Active Products, Avg. Confidence Score, Flagged Records, Pending Duplicates, Total Batches — all scoped to the active organisation
* Recent activity — last 10 extraction and export events pulled from D1, scoped to the active organisation
* Analytics section:
  * Products processed over time — line chart
  * Confidence score distribution — bar chart
  * Extraction success rate by field — horizontal bar chart showing which IMDB columns are most often flagged

---

## Multi-Tenancy Architecture

Every piece of data in ShelfMind is scoped to an organisation. The tenancy boundary is enforced at the API layer — not the UI.

### Data isolation

* Every D1 table that holds product data includes an `organisation_id` column
* All Workers API queries include `WHERE organisation_id = ?` with the value pulled from the session — never from user input
* R2 keys are namespaced: `uploads/{orgId}/...` and `exports/{orgId}/...`
* KV cache keys are namespaced: `ai:{orgId}:{imageHash}`

### Organisation switching

* User selects an organisation from the workspace switcher
* better-auth updates the active organisation in the session
* All subsequent API calls and D1 queries re-scope to the new org automatically
* No page reload required — TanStack Start re-fetches scoped data on session change

### Invitation and membership

* Invitations, members, and roles are managed entirely by better-auth's organisation plugin
* Owner and admin roles enforced server-side on all mutating routes
* Member role can read, upload, review, and export — cannot invite or delete

---

## Data Architecture

### IMDB Records

* Live in `imdb_records` table in D1
* One row per product per job, scoped to `organisation_id`
* **Soft-deletion model:** Records are never hard-deleted. A `status` column (`'ACTIVE'` | `'DELETED'`) controls visibility. All repository, export, and duplicate queries filter on `status = 'ACTIVE'`.
* **Merge lineage:** When a duplicate is merged, the losing record's `merged_into_id` column is set to the surviving record's ID. This creates a directed graph allowing any soft-deleted record to be traced back to its parent — full MDM audit trail.
* Written by the Processing Worker after merge; never modified by the extraction pipeline after that
* Only changed when a user explicitly edits a field on the Review Queue page, or when a duplicate merge enriches the winning record

### Duplicate Pairs

* Live in `duplicate_pairs` table in D1, scoped to `organisation_id`
* **Pre-calculated asynchronously** at the end of each pipeline job — never computed on the fly at the API layer
* Schema: `id`, `org_id`, `record_a_id`, `record_b_id`, `similarity_score`, `reason`, `status`, `created_at`, `resolved_at`
* Detection compares new records against existing `ACTIVE` records by barcode match and normalized brand+weight similarity
* `status` lifecycle: `'PENDING'` → `'DISMISSED'` (false positive) | `'MERGED'` (records combined)
* The UI reads from this table with a simple indexed `SELECT ... WHERE org_id = ? AND status = 'PENDING'` — millisecond response times regardless of repository size

### Jobs

* Live in `jobs` table in D1, scoped to `organisation_id`
* Tracks: `id`, `organisation_id`, `status` (PENDING / PROCESSING / COMPLETED / FAILED), `progress`, `image_count`, `started_at`, `completed_at`, `error`
* Frontend polls `GET /jobs/:id` → KV cache → D1 fallback

### Extraction Cache

* AI results cached in KV keyed by `ai:{orgId}:{imageHash}`
* Cache hit skips the AI call entirely — zero AI cost on re-processed images
* TTL: 7 days

### Images

* Original uploads stored in R2 under `uploads/{orgId}/{jobId}/{imageId}`
* Exported files stored in R2 under `exports/{orgId}/{jobId}/imdb_export.xlsx`
* Signed URLs returned to frontend; files never served directly through Workers

---

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | TanStack Start + Shadcn UI |
| Authentication | better-auth (organisation plugin + Google OAuth) |
| Backend | Cloudflare Workers |
| Queue | Cloudflare Queues |
| Image storage | Cloudflare R2 |
| Image preprocessing | Cloudflare Images binding (`env.IMAGES`) — background removal + margin cropping |
| Background removal | Cloudflare Images `segment: "foreground"` (BiRefNet AI) |
| OCR | RolmOCR via Fireworks AI (primary) / Google Vision (fallback) |
| Vision extraction | Qwen3-VL via Fireworks AI |
| Database | Cloudflare D1 |
| Cache | Cloudflare KV |
| Export generation | ExcelJS |

---

## Features In Scope

* Homepage with hero, how it works, features section, footer
* Sidebar navigation — Dashboard, Uploads, Processing Queue, Review Queue, Product Repository, Duplicates, Export Center
* better-auth authentication — email + password and Google OAuth
* better-auth organisation plugin — multi-tenancy, member roles, invitations
* Organisation creation on first login
* Workspace switcher in app shell for multi-org users
* Member invitation flow with role assignment (owner / admin / member)
* Organisation settings page — name, members, pending invites
* Batch image upload (up to 20 images) with drag-and-drop
* R2 image storage namespaced by org and job
* Cloudflare Queues async processing with retry and DLQ
* **Physical Watermark Tag Parsing:** Deterministic extraction of audit identity, product description, weight, side, manufacturer, and country from a printed tag on each audit photo. Overrides Qwen3-VL values for maximum accuracy.
* **Multi-Margin Watermark Fallback:** If the watermark tag is not found in full-image OCR, the pipeline systematically crops and re-OCRs all four edges (bottom → top → left → right) of the original image.
* **AI Background Removal:** Cloudflare Images BiRefNet segmentation strips the shelf/store environment from every product image before OCR and Qwen inference, preventing neighbor-product label contamination. Applied after watermark extraction so edge tags are preserved.
* **Side-Label Intelligence:** Each extraction carries an `imageSide` field (Front/Back/Left/Right/Barcode) parsed from the watermark tag. During grouping aggregation, a confidence boost (+0.10/+0.15) is applied per field based on which side canonically owns that data — Front wins on BRAND/ITEM_NAME, Back wins on MANUFACTURER/COUNTRY, Barcode side wins on BARCODE.
* OCR extraction via RolmOCR (Fireworks AI) or Google Vision, configurable per org
* Vision AI extraction via Qwen3-VL (Fireworks AI) — maps clean product label to full 13-column IMDB schema
* **Brand Conflict and Barcode Conflict Guards:** Strict grouping invariants in `lib/grouping.ts` using `hasBrandConflict` and `hasBarcodeConflict` — prevent distinct products from being merged into a single record
* **Local Market Normalization:** Regex logic mapped to extract primary English values from bilingual wrappers and correctly normalize non-standard weights
* **Weight/Volume Grouping Blocker:** Products with identical names but different weights/volumes are forced into separate IMDB records — never merged
* Processing Queue page with live job status polling
* **Real-time Pipeline Visualizer** using React Flow, Durable Objects, and WebSockets — 8 nodes: Image Ingestion → RolmOCR → Watermark Parsing → BG Removal → Qwen3-VL Extraction → Map-based Grouping → Database Write → Merge Suggestions
* Review Queue with filter, sort, inline edit, and confidence indicators
* Individual record detail page with full extraction evidence panel
* Product Repository — cross-job searchable master record table (active records only)
* **Pre-Calculated Duplicate Detection:** Pairs detected asynchronously at end of each job, stored in `duplicate_pairs` table, with side-by-side review UI
* **Soft-Deletion with Merge Lineage:** Records are never hard-deleted. Merged duplicates retain `merged_into_id` pointing to the surviving parent for full MDM auditability
* Export to Excel (.xlsx via ExcelJS), CSV, and JSON, scoped to active organisation (active records only)
* Export history with signed R2 download links
* Dashboard with stats bar, recent activity feed, and three analytics charts — all org-scoped
* Per-image and per-field confidence scoring throughout
* All API routes enforce organisation scoping from session — never from user input

---

## Features Out of Scope

* Auto-database upload — ShelfMind produces a file for manual import; it does not push records to any external system
* Live barcode scanning from a device camera
* PDF label support — image uploads only (JPG, PNG, WEBP)
* Multiple active jobs running simultaneously per organisation
* Resume or partial re-extraction — resubmit the full image set
* Cover page or report generation — export is structured data only
* Mobile app — responsive web only
* Scheduled or automated batch runs — manual submission only
* Version history on IMDB records — latest edit wins
* Payment or subscription system
* Separate analytics page — charts live on dashboard
* Real-time agent feed or live browser embed
* LinkedIn or external marketplace integration
* Multi-Agent Orchestration — Pipeline relies on optimized parallel single-turn extraction

---

## Cloudflare Services

```text
Cloudflare Workers   → API backend + Processing Worker
Cloudflare Queues    → Async job dispatch with retry + DLQ
Cloudflare R2        → Image storage + export file storage (namespaced by org)
Cloudflare D1        → IMDB records, jobs, duplicate pairs, organisation profiles (all org-scoped)
Cloudflare KV        → AI result cache (7-day TTL, keyed by org + image hash)
Durable Objects      → Stateful observability (JobCoordinator) broadcasting pipeline updates via WebSockets
Cloudflare Images    → Background removal (segment: foreground, BiRefNet AI) + margin cropping for watermark detection
```

---

## Extraction Confidence Schema

Each extracted field carries a confidence object (canonical type defined in `src/types/imdb.ts`):

```typescript
{
  value: string;
  source: "ZXing" | "OCR" | "Vision" | "Merged";
  confidence: number; // 0.0 – 1.0
}
```

The merged record's overall confidence is a **weighted mean** using `FIELD_WEIGHTS` from `src/types/imdb.ts` (barcode: 1.0, item name: 0.9, brand: 0.85, etc.). Records with overall confidence below 0.75 are surfaced first in the Review Queue and marked "Needs Review." Fields with confidence below 0.3 are set to empty string — ShelfMind never hallucates values.

During side-aware grouping, confidence is transiently boosted (+0.10 for canonical Front/Back fields, +0.15 for Barcode) to determine merge priority. The stored confidence in D1 always reflects the raw extracted value — the boost is never persisted.

---

## IMDB Columns

All 13 columns extracted per product (canonical order from `src/types/imdb.ts`):

```text
ITEM_NAME           → Watermark tag (primary) → Qwen3-VL → OCR merged
BARCODE             → Barcode-side watermark → Qwen3-VL fallback
MANUFACTURER        → Watermark tag (primary) → Qwen3-VL → OCR merged
BRAND               → Qwen3-VL (Front-side priority) → OCR merged
WEIGHT              → Watermark tag (primary) → OCR (regex validated) → Qwen3-VL, normalized
PACKAGING_TYPE      → Watermark tag → Qwen3-VL normalized (e.g. "hdpe bottle" → "Bottle")
COUNTRY             → Watermark tag (primary) → Qwen3-VL → OCR merged, normalized
VARIANT             → Qwen3-VL (Front-side priority)
TYPE                → Qwen3-VL
FRAGRANCE_FLAVOR    → Qwen3-VL → OCR merged
PROMOTION           → Qwen3-VL (Back-side priority) → OCR merged
ADDONS              → Qwen3-VL (Back-side priority) → OCR merged
TAGLINE             → Qwen3-VL (Front-side priority) → OCR merged
```

Additionally, each `IMDBProduct` carries two metadata fields used only during pipeline processing and never exported:
- `imageSide?: string` — the watermark side (Front/Back/Left/Right/Barcode)
- `imageTag?: string` — the deterministic group key derived from the watermark auditId

The canonical TypeScript type for the full 13-column record, field confidence metadata, weighted confidence constants, and export column ordering lives in `src/types/imdb.ts` — the single source of truth imported by `db/schema.ts`, `lib/pipeline.ts`, `lib/export.ts`, `lib/normalization.ts`, `lib/grouping.ts`, and review UI components.