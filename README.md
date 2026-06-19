![Dashboard Screenshot](./public/dashboard.png)

# ShelfMind

ShelfMind is an AI-powered image-to-item master data tool built for retail teams. A field agent photographs a product, uploads it through the web interface, and ShelfMind's extraction pipeline automatically reads the image and fills all 13 Item Master Database (IMDB) columns — with per-field confidence scores. The user reviews the extracted records, edits any flagged fields, and exports a clean Excel or CSV file ready for database upload.

Built as a multi-tenant SaaS on Cloudflare's edge infrastructure. Every step — API, background processing, storage, real-time observability — runs on Cloudflare Workers, Queues, R2, D1, KV, and Durable Objects.

---

## How It Works

```
Upload images → AI extracts 13 IMDB fields → Review & edit flagged records → Export predictions.xlsx
```

### Extraction Pipeline (per image)

1. **OCR on original image** — RolmOCR (Fireworks AI) or Google Vision reads the raw product photo. The output is scanned line-by-line for a physical watermark tag printed on each audit photo. If not found, the pipeline crops and re-OCRs all four edges (bottom → top → left → right) as a fallback.

2. **Background removal** — Cloudflare Images BiRefNet AI strips the shelf/store environment from the product photo, isolating the product on a clean white background. A second OCR pass runs on the clean image.

3. **Qwen3-VL extraction** — The clean image + OCR text is sent to Qwen3-VL (Fireworks AI), which maps the product label to the full 13-column IMDB JSON schema. Watermark tag values override Qwen's output for maximum accuracy.

4. **Side-aware grouping** — Extractions from multiple images of the same product are grouped by watermark tag → barcode → name. Each image carries a `side` field (Front/Back/Left/Right/Barcode) that determines which image wins for each field (e.g. Front wins BRAND/ITEM_NAME, Back wins MANUFACTURER/COUNTRY).

5. **Database write** — Merged records are written to D1, scoped to the organisation.

6. **Duplicate detection** — New records are compared against existing active records by barcode match and brand+weight similarity. Matching pairs are stored in `duplicate_pairs` for human review.

### IMDB Columns Extracted

```
ITEM_NAME  BARCODE  MANUFACTURER  BRAND  WEIGHT  PACKAGING_TYPE
COUNTRY    VARIANT  TYPE          FRAGRANCE_FLAVOR  PROMOTION
ADDONS     TAGLINE
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | TanStack Start (Vite + React 19) |
| Routing | TanStack Router (file-based) |
| Data fetching | TanStack Query |
| Forms & tables | TanStack Form + TanStack Table |
| Auth | Better Auth (email/password + Google OAuth, multi-tenant orgs) |
| Database | Cloudflare D1 (SQLite) via Drizzle ORM |
| Storage | Cloudflare R2 (images + exports) |
| Background jobs | Cloudflare Queues |
| Real-time | Cloudflare Durable Objects + WebSockets |
| Cache | Cloudflare KV (7-day AI result cache) |
| Image processing | Cloudflare Images binding (BiRefNet background removal + margin crops) |
| OCR | RolmOCR via Fireworks AI (primary) / Google Vision (fallback) |
| Vision AI | Qwen3-VL via Fireworks AI |
| Pipeline visualizer | React Flow (`@xyflow/react`) |
| UI | shadcn/ui + Tailwind CSS v4 |
| Runtime | Bun |
| Linting/formatting | Biome |

---

## Prerequisites

- [Bun](https://bun.sh/) v1.1+
- [Wrangler](https://developers.cloudflare.com/workers/wrangler/) v4+ (`npm install -g wrangler`)
- A Cloudflare account with Workers, D1, R2, KV, Queues, Durable Objects, and Images enabled
- A Fireworks AI API key (for RolmOCR + Qwen3-VL)
- A Google OAuth app (for social login)

---

## Local Development

### 1. Install dependencies

```bash
bun install
```

### 2. Set up environment variables

Copy the example env file and fill in your values:

```bash
cp .env.example .env.local
```

Required variables:

```env
# Auth
BETTER_AUTH_SECRET=          # Generate with: bunx --bun @better-auth/cli secret
BETTER_AUTH_URL=http://localhost:3000

# Google OAuth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# AI providers
FIREWORKS_API_KEY=           # RolmOCR + Qwen3-VL
GOOGLE_VISION_API_KEY=       # Optional fallback OCR

# Qwen (if using direct endpoint instead of Fireworks)
QWEN_API_KEY=
QWEN_API_ENDPOINT=
```

### 3. Run database migrations

```bash
bun run db:migrate
```

### 4. Start the dev server

```bash
bun --bun run dev
```

The app runs at `http://localhost:3000`. Cloudflare bindings (R2, KV, Queues, D1, Images) are mocked locally via Wrangler's `.wrangler/` directory — no real Cloudflare account needed for local development.

---

## Database

This project uses Drizzle ORM with Cloudflare D1 in production and SQLite locally.

```bash
# Generate a new migration after schema changes
bun run db:generate

# Apply migrations
bun run db:migrate

# Push schema directly (dev only, skips migration files)
bun run db:push

# Open Drizzle Studio (visual DB browser)
bun run db:studio
```

---

## Scripts

```bash
bun --bun run dev        # Start local dev server (port 3000)
bun --bun run build      # Production build
bun --bun run preview    # Preview production build locally
bun --bun run test       # Run tests (Vitest)
bun --bun run lint       # Lint with Biome
bun --bun run format     # Format with Biome
bun --bun run check      # Lint + format check
bun run deploy           # Build + deploy to Cloudflare Workers
```

---

## Deployment

### 1. Authenticate with Cloudflare

```bash
wrangler login
```

### 2. Create Cloudflare resources

Create the D1 database, R2 buckets, KV namespace, and Queue, then update `wrangler.jsonc` with the returned IDs:

```bash
wrangler d1 create shelfmind-db
wrangler r2 bucket create shelfmind-images
wrangler r2 bucket create shelfmind-exports
wrangler kv namespace create CACHE
wrangler queues create image-processing
```

### 3. Set production secrets

```bash
wrangler secret put BETTER_AUTH_SECRET
wrangler secret put GOOGLE_CLIENT_ID
wrangler secret put GOOGLE_CLIENT_SECRET
wrangler secret put FIREWORKS_API_KEY
wrangler secret put QWEN_API_KEY
wrangler secret put QWEN_API_ENDPOINT
```

### 4. Run D1 migrations in production

```bash
wrangler d1 migrations apply shelfmind-db --remote
```

### 5. Deploy

```bash
bun run deploy
```

---

## Project Structure

```
shelfmind/
├── context/                    # Project documentation and architecture notes
├── src/
│   ├── types/
│   │   ├── imdb.ts             # Canonical 13-column IMDB type, FIELD_WEIGHTS, confidence constants
│   │   └── pipeline.ts         # React Flow node/edge definitions for the pipeline visualizer
│   ├── db/
│   │   ├── schema.ts           # Drizzle schema (jobs, imdb_records, duplicate_pairs)
│   │   └── index.ts            # D1 (prod) / SQLite (local) client factory
│   ├── lib/
│   │   ├── pipeline.ts         # Core extraction engine: OCR → watermark → BG removal → Qwen → grouping → DB
│   │   ├── watermark-parser.ts # Deterministic watermark tag parser
│   │   ├── grouping.ts         # Side-aware, conflict-guarded product grouping engine
│   │   ├── normalization.ts    # Weight, packaging, manufacturer, and country normalization
│   │   ├── export.ts           # Excel/CSV/JSON export generator
│   │   ├── storage.ts          # R2 wrapper
│   │   ├── queue.ts            # Cloudflare Queue wrapper
│   │   └── auth.ts             # Better Auth server config
│   ├── components/
│   │   ├── pipeline/           # React Flow custom nodes and pipeline visualizer
│   │   ├── dashboard/          # ImdbTable, UploadForm, JobList, RecordDetail, DuplicateCard
│   │   └── ui/                 # shadcn/ui primitives
│   ├── hooks/                  # TanStack Query hooks (useProducts, usePipelineStream, etc.)
│   ├── routes/
│   │   ├── dashboard/          # All dashboard pages (uploads, queue, review, products, exports)
│   │   └── api/                # API route handlers (jobs, records, products, duplicates, stats)
│   ├── workers/
│   │   └── jobCoordinator.ts   # Durable Object — real-time pipeline state broadcaster via WebSockets
│   └── entry.worker.ts         # Cloudflare Worker entry point + Queue consumer
├── drizzle/                    # Generated migration files
├── wrangler.jsonc              # Cloudflare bindings configuration
├── vite.config.ts
└── package.json
```

---

## Pages

| Route | Description |
|---|---|
| `/` | Landing page |
| `/login` | Email + Google OAuth sign-in |
| `/signup` | Account creation |
| `/dashboard` | Workspace overview — stats, activity feed, analytics charts |
| `/dashboard/uploads` | Batch image upload (up to 20 images, drag-and-drop) |
| `/dashboard/processing-queue` | Live job status list with polling |
| `/dashboard/jobs/:jobId` | Real-time React Flow pipeline visualizer (8 nodes, WebSocket-streamed) |
| `/dashboard/review-queue` | Flagged records table — filter, sort, inline edit |
| `/dashboard/review-queue/:recordId` | Individual record detail with full extraction evidence |
| `/dashboard/products` | Cross-job searchable master product repository |
| `/dashboard/exports` | Export center — Excel, CSV, JSON with export history |

---

## Multi-Tenancy

Every piece of data is scoped to an organisation. The tenancy boundary is enforced at the API layer — never the UI.

- All D1 tables include an `organisation_id` column; all queries include `WHERE organisation_id = ?` from the session
- R2 keys are namespaced: `uploads/{orgId}/...` and `exports/{orgId}/...`
- KV cache keys are namespaced: `ai:{orgId}:{imageHash}`
- Users can belong to multiple organisations and switch between them from the workspace switcher

Roles: `owner` → `admin` → `member`. Enforced server-side on all mutating routes.

---

## Confidence Scoring

Each extracted field carries a confidence score (0.0–1.0). The overall record confidence is a **weighted mean** using `FIELD_WEIGHTS` from `src/types/imdb.ts`:

```
BARCODE: 1.0  ITEM_NAME: 0.9  BRAND: 0.85  MANUFACTURER: 0.8  WEIGHT: 0.8
PACKAGING_TYPE: 0.75  COUNTRY: 0.7  TYPE: 0.65  VARIANT: 0.65
FRAGRANCE_FLAVOR: 0.6  PROMOTION: 0.5  ADDONS: 0.5  TAGLINE: 0.5
```

- Records with overall confidence **below 0.75** are flagged as "Needs Review"
- Fields with confidence **below 0.3** are set to empty string — ShelfMind never hallucates values

---

## Running Tests

```bash
bun --bun run test
```

Tests use [Vitest](https://vitest.dev/). The grouping engine (`src/lib/grouping.test.ts`) has unit tests for the conflict guards and fuzzy matching logic.
```