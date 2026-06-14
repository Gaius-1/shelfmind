import type { ImdbColumnName } from "../types/imdb.ts";

/**
 * Standardizes weight strings (e.g., "500 g" -> "500g", "0.5 kg" -> "500g").
 */
export function normalizeWeight(raw: string): string {
	if (!raw) return "";
	let clean = raw.trim().toLowerCase();
	if (clean.endsWith(".")) {
		clean = clean.slice(0, -1);
	}

	// Regex to match a number and its unit
	const match = clean.match(
		/^([\d.,]+)\s*(g|kg|ml|l|grams|kilograms|liters|litres|millilitres|milliliters|pcs|pack|pk|oz|fl\.?\s*oz)?$/,
	);
	if (match) {
		const numStr = match[1].replace(",", ".");
		const num = parseFloat(numStr);
		const unit = match[2] || "";

		if (!isNaN(num)) {
			if (unit.startsWith("gram") || unit === "g") {
				return `${num}g`;
			}
			if (unit.startsWith("kilogram") || unit === "kg") {
				if (num < 1) {
					return `${num * 1000}g`;
				}
				return `${num}kg`;
			}
			if (
				unit.startsWith("milliliter") ||
				unit.startsWith("millilitre") ||
				unit === "ml"
			) {
				return `${num}ml`;
			}
			if (
				unit.startsWith("liter") ||
				unit.startsWith("litre") ||
				unit === "l"
			) {
				if (num < 1) {
					return `${num * 1000}ml`;
				}
				return `${num}l`;
			}
			if (unit === "pcs" || unit === "pc") return `${num}pcs`;
			if (unit.startsWith("pack") || unit === "pk") return `${num}pack`;
			if (unit === "oz") return `${num}oz`;
			if (unit.includes("fl")) return `${num}fl oz`;
			return `${num}${unit}`;
		}
	}

	// Collapse spaces if it doesn't match standard patterns
	return raw.trim().replace(/\s+/g, " ");
}

/**
 * Canonicalizes packaging types to standard labels.
 */
export function normalizePackaging(raw: string): string {
	if (!raw) return "";
	const clean = raw.trim().toLowerCase();
	if (
		clean.includes("bottle") ||
		clean.includes("hdpe") ||
		clean.includes("pet")
	)
		return "Bottle";
	if (clean.includes("can") || clean.includes("tin")) return "Can";
	if (clean.includes("box") || clean.includes("carton")) return "Box";
	if (clean.includes("pack") || clean.includes("packet")) return "Pack";
	if (clean.includes("jar")) return "Jar";
	if (clean.includes("pouch") || clean.includes("sachet")) return "Pouch";
	if (clean.includes("tube")) return "Tube";
	if (clean.includes("tub")) return "Tub";
	if (clean.includes("bag")) return "Bag";
	if (clean.includes("wrapper") || clean.includes("wrap")) return "Wrapper";

	// Default to title case
	return clean.charAt(0).toUpperCase() + clean.slice(1);
}

// Country mappings
const COUNTRY_MAP: Record<string, string> = {
	rsa: "South Africa",
	za: "South Africa",
	"south africa": "South Africa",
	us: "United States",
	usa: "United States",
	"united states": "United States",
	"united states of america": "United States",
	uk: "United Kingdom",
	"united kingdom": "United Kingdom",
	gb: "United Kingdom",
	"great britain": "United Kingdom",
	de: "Germany",
	germany: "Germany",
	fr: "France",
	france: "France",
	in: "India",
	india: "India",
	cn: "China",
	china: "China",
	jp: "Japan",
	japan: "Japan",
	gh: "Ghana",
	ghana: "Ghana",
	ci: "Côte d'Ivoire",
	"cote d'ivoire": "Côte d'Ivoire",
	"ivory coast": "Côte d'Ivoire",
	be: "Belgium",
	belgium: "Belgium",
	ae: "United Arab Emirates",
	uae: "United Arab Emirates",
	bf: "Burkina Faso",
	"burkina faso": "Burkina Faso",
	ng: "Nigeria",
	nigeria: "Nigeria",
	ke: "Kenya",
	kenya: "Kenya",
};

/**
 * Normalizes country names to a canonical standard representation.
 */
export function normalizeCountry(raw: string): string {
	if (!raw) return "";
	const clean = raw.trim().toLowerCase();
	if (COUNTRY_MAP[clean]) {
		return COUNTRY_MAP[clean];
	}
	// Title case default
	return raw
		.trim()
		.replace(/\s+/g, " ")
		.split(" ")
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
		.join(" ");
}

/** Regex matching common accented characters found in non-English (e.g. French) text. */
const ACCENTED_CHARS_RE = /[àâäéèêëïîôùûüÿçœæ]/i;

/**
 * Detects bilingual text patterns like "English Text / French Text" or
 * "English Text | French Text" and returns only the first (English) part.
 *
 * Only strips if the second part contains accented characters typical of
 * non-English translations.
 *
 * Recognised separators (with surrounding spaces): ` / `, ` | `, ` - `.
 */
export function stripBilingualText(raw: string): string {
	if (!raw) return "";

	const lower = raw.toLowerCase();

	// Detect English/French column-style sections
	const ingrIdx = lower.indexOf("ingredients:");
	const ingrFrIdx = lower.indexOf("ingrédients:");
	if (ingrIdx !== -1 && ingrFrIdx > ingrIdx) {
		return raw.slice(0, raw.toLowerCase().indexOf("ingrédients:")).trim();
	}

	const dirIdx = lower.indexOf("directions:");
	const dirFrIdx = lower.indexOf("indications:");
	if (dirIdx !== -1 && dirFrIdx > dirIdx) {
		return raw.slice(0, raw.toLowerCase().indexOf("indications:")).trim();
	}

	// Try each separator in priority order
	for (const sep of [" / ", " | ", " - "]) {
		const idx = raw.indexOf(sep);
		if (idx === -1) continue;

		const firstPart = raw.slice(0, idx).trim();
		const secondPart = raw.slice(idx + sep.length).trim();

		// Only strip when the second part looks like a non-English translation
		if (secondPart && ACCENTED_CHARS_RE.test(secondPart)) {
			return firstPart;
		}
	}

	return raw;
}

/** Fields where bilingual stripping should be applied. */
const BILINGUAL_FIELDS: readonly ImdbColumnName[] = [
	"ITEM_NAME",
	"MANUFACTURER",
	"BRAND",
	"VARIANT",
	"TYPE",
	"FRAGRANCE_FLAVOR",
	"PROMOTION",
	"ADDONS",
	"TAGLINE",
] as const;

/**
 * Normalizes a specific field by its column type.
 */
export function normalizeField(
	column: ImdbColumnName,
	rawValue: string | null | undefined,
): string {
	if (rawValue === null || rawValue === undefined) return "";

	let clean = rawValue.trim().replace(/\s+/g, " ");
	if (!clean) return "";

	// Apply bilingual stripping to text-heavy fields before further normalization
	if ((BILINGUAL_FIELDS as readonly string[]).includes(column)) {
		clean = stripBilingualText(clean);
	}

	switch (column) {
		case "WEIGHT":
			return normalizeWeight(clean);
		case "PACKAGING_TYPE":
			return normalizePackaging(clean);
		case "COUNTRY":
			return normalizeCountry(clean);
		case "BARCODE":
			// Strip any non-numeric characters for barcodes, except keep if alphanumeric is expected (usually only digits)
			return clean.replace(/[^\d]/g, "").replace(/^0+/, "");
		default:
			return clean;
	}
}

/**
 * Performs full record-level normalization across all 13 columns.
 */
export function normalizeRecord(
	record: Partial<Record<ImdbColumnName, string>>,
): Record<ImdbColumnName, string> {
	const result = {} as Record<ImdbColumnName, string>;

	// Make sure we iterate over all columns to fill in defaults
	const columns: ImdbColumnName[] = [
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
	];

	for (const col of columns) {
		result[col] = normalizeField(col, record[col]);
	}

	return result;
}
