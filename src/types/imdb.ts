/**
 * Canonical IMDB column definitions — single source of truth.
 *
 * Imported by:
 *   db/schema.ts, lib/pipeline.ts, lib/export.ts,
 *   lib/normalization.ts, and review UI components.
 */

// ─── 13 IMDB Column Names (exact ground-truth order) ─────────────────────────

export const IMDB_COLUMNS = [
	"ITEM_NAME",
	"BARCODE",
	"MANUFACTURER",
	"BRAND",
	"WEIGHT",
	"PACKAGING_TYPE",
	"COUNTRY",
	"VARIANT",
	"TYPE",
	"FRAGRANCE_FLAVOR",
	"PROMOTION",
	"ADDONS",
	"TAGLINE",
] as const;

export type ImdbColumnName = (typeof IMDB_COLUMNS)[number];

// ─── Excel Header Mapping ────────────────────────────────────────────────────
// DB uses underscores; Excel output must match ground-truth headers exactly.

export const EXCEL_HEADERS: Record<ImdbColumnName, string> = {
	ITEM_NAME: "ITEM_NAME",
	BARCODE: "BARCODE",
	MANUFACTURER: "MANUFACTURER",
	BRAND: "BRAND",
	WEIGHT: "WEIGHT",
	PACKAGING_TYPE: "PACKAGING TYPE", // single space
	COUNTRY: "COUNTRY",
	VARIANT: "VARIANT",
	TYPE: "TYPE",
	FRAGRANCE_FLAVOR: "FRAGRANCE_FLAVOR",
	PROMOTION: "PROMOTION",
	ADDONS: "ADDONS",
	TAGLINE: "TAGLINE",
};

// ─── Per-Field Extraction Metadata ───────────────────────────────────────────

export type ExtractionSource =
	| "ZXing"
	| "OCR"
	| "Vision"
	| "Merged"
	| "Watermark";

export interface FieldMeta {
	value: string;
	source: ExtractionSource;
	confidence: number; // 0.0–1.0
}

// ─── Raw Extraction Evidence ─────────────────────────────────────────────────
// Stored as JSON in the `raw_extraction` column for full audit trail.

export interface RawExtractionPerImage {
	fileName: string;
	zxing: { barcode: string | null } | null;
	ocr: string | null; // raw text blob from VLM OCR prompt
	vision: Partial<Record<ImdbColumnName, string>> | null; // structured JSON from VLM
}

export interface RawExtraction {
	images: RawExtractionPerImage[];
}

// ─── Confidence Weights ──────────────────────────────────────────────────────
// Higher weight = more important for overall record confidence.

export const FIELD_WEIGHTS: Record<ImdbColumnName, number> = {
	BARCODE: 1.0,
	ITEM_NAME: 0.9,
	BRAND: 0.85,
	MANUFACTURER: 0.8,
	WEIGHT: 0.8,
	PACKAGING_TYPE: 0.75,
	COUNTRY: 0.7,
	TYPE: 0.65,
	VARIANT: 0.65,
	FRAGRANCE_FLAVOR: 0.6,
	PROMOTION: 0.5,
	ADDONS: 0.5,
	TAGLINE: 0.5,
};

// ─── Computed Record Type ────────────────────────────────────────────────────

export type ImdbRecord = Record<ImdbColumnName, string>;

export interface IMDBProduct {
	ITEM_NAME: string;
	BARCODE: string;
	MANUFACTURER: string;
	BRAND: string;
	WEIGHT: string;
	PACKAGING_TYPE: string;
	COUNTRY: string;
	VARIANT: string;
	TYPE: string;
	FRAGRANCE_FLAVOR: string;
	PROMOTION: string;
	ADDONS: string;
	TAGLINE: string;
	// Metadata for grouping and confidence
	imageTag?: string;
	imageSide?: string; // Parsed from watermark tag: "Front" | "Back" | "Left" | "Right" | "Barcode" | "Top" | "Bottom"
	sourceImages: string[];
	rawVisionData?: Record<string, any>;
	fieldConfidence?: Record<string, number>;
}

export interface ImdbRecordWithMeta {
	record: ImdbRecord;
	confidence: number;
	flagged: boolean;
	fieldMetadata: Record<ImdbColumnName, FieldMeta>;
	rawExtraction: RawExtraction;
	productGroupKey: string;
}

// ─── Confidence Threshold ────────────────────────────────────────────────────

/** Records with overall confidence below this are flagged for review. */
export const CONFIDENCE_THRESHOLD = 0.75;

/** Fields with confidence below this are set to empty string (never hallucinate). */
export const FIELD_EMPTY_THRESHOLD = 0.3;
