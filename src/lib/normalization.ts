import type { ImdbColumnName } from "../types/imdb.ts";

/**
 * Standardizes weight strings (e.g., "500 g" -> "500g", "0.5 kg" -> "500g").
 */
export function normalizeWeight(rawWeight: string): string {
	if (!rawWeight) return "";
	const match = rawWeight.match(/(\d+(?:\.\d+)?)\s*(G|KG|ML|L)/i);
	if (!match) return rawWeight.toUpperCase().trim();
	let [_, value, unit] = match;
	unit = unit.toUpperCase();

	if (value === "1000" && unit === "ML") { value = "1"; unit = "L"; }
	else if (value === "1000" && unit === "G") { value = "1"; unit = "KG"; }
	else if (value === "2200" && unit === "G") { value = "2.2"; unit = "KG"; }

	return `${value}${unit}`;
}

export function normalizeBarcode(rawBarcode: string): string {
	if (!rawBarcode) return "";
	return rawBarcode.replace(/\D/g, "");
}

const BRAND_PACKAGING_OVERRIDES: Record<string, { matches: string[], override: string }[]> = {
	"kivo": [
		{ matches: ["pouch", "sachet", "pack"], override: "POUCH" }
	]
};

/**
 * Canonicalizes packaging types to standard labels.
 */
export function normalizePackaging(raw: string, brand?: string): string {
	if (!raw) return "";
	const clean = raw.trim().toLowerCase();
	const brandClean = brand ? brand.trim().toLowerCase() : "";

	if (brandClean && BRAND_PACKAGING_OVERRIDES[brandClean]) {
		for (const rule of BRAND_PACKAGING_OVERRIDES[brandClean]) {
			if (rule.matches.some(m => clean.includes(m))) {
				return rule.override;
			}
		}
	}

	if (
		clean.includes("bottle") ||
		clean.includes("hdpe") ||
		clean.includes("pet")
	)
		return "PLASTIC BOTTLE";
	if (clean.includes("tin")) return "TIN";
	if (clean.includes("can")) return "CAN";
	if (clean.includes("box") || clean.includes("carton")) return "BOX";
	if (clean.includes("glass") || clean.includes("jar")) return "GLASS JAR";
	if (clean.includes("pouch")) return "POUCH";
	if (clean.includes("sachet")) return "SACHET";
	if (clean.includes("tube")) return "TUBE";
	if (clean.includes("tub")) return "TUB";
	if (clean.includes("plastic bag")) return "PLASTIC BAG";
	if (clean.includes("bag")) return "PLASTIC BAG";
	if (clean === "wrapped") return "WRAPPED";
	if (clean.includes("wrapper") || clean.includes("wrap")) return "WRAPPER";
	if (clean.includes("tetra")) return "TETRA PAK";
	if (clean.includes("pack") || clean.includes("packet")) return "PACK";

	// Default to uppercase
	return raw.trim().toUpperCase();
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
	prc: "China",
	"p.r.c": "China",
	"p.r.c.": "China",
	"people's republic of china": "China",
	jp: "Japan",
	japan: "Japan",
	id: "Indonesia",
	indonesia: "Indonesia",
	lk: "Sri Lanka",
	"sri lanka": "Sri Lanka",
	gh: "Ghana",
	ghana: "Ghana",
	ci: "Cote d'Ivoire",
	"cote d'ivoire": "Cote d'Ivoire",
	"ivory coast": "Cote d'Ivoire",
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
	// Strip accents/diacritics and convert to lowercase for matching
	const clean = raw.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
	if (COUNTRY_MAP[clean]) {
		return COUNTRY_MAP[clean].toUpperCase();
	}
	// UPPERCASE default, stripping accents to match CSV standards
	return raw
		.trim()
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.toUpperCase();
}

const MANUFACTURER_MAP: Record<string, string> = {
	"upfield ghana ltd": "UPFIELD",
	"upfield ghana manufacturing limited": "UPFIELD",
	"ajc ghana": "AJC TRADING CO LTD",
	"al-ain national juice & refreshment co.": "AL AIN COMPANY LTD",
	"coca cola company ltd.": "THE COCA COLA COMPANY",
	"hema global beverages": "THE COCA COLA COMPANY",
	"nestle nigeria ltd": "NESTLE",
	"nestle ghana ltd": "NESTLE",
	"fagip ventures": "FAGIP VENTURES",
	"nutrifoods ghana limited": "NUTRIFOODS",
	"sister sardine & mackerel": "SISTER SARDINE & MACKEREL VENTURES",
	"xiaman oasis food company ltd": "SISTER SARDINE & MACKEREL VENTURES",
	"d- u fresh co.ltd": "U-FRESH ENTERPRISES",
	"u fresh co ltd.": "U-FRESH ENTERPRISES",
	"aqfrsh": "AQUAFRESH LIMITED",
	"nat vet phat food co. limited vietnam": "NAM VIET PHAT FOOD CO. LIMITED",
	"b-diet ltd tamale": "B-DIET LTD",
	"diakite ramta commercante": "SENICO",
	"sunda purecare ltd company": "HOMEPRO COMPANY LTD",
	"meiji ghana ltd.": "LGD LIMITED",
	"sdtm": "S.D.T.M",
	"africa consumer products ghana ltd": "AFRICAN CONSUMER PRODUCTS",
	"atona foods": "ATONA FOODS",
	"promasidor ghana ltd": "PROMASIDOR",
	"blow- chem industries limited": "BLOW CHEM INDUSTRIES LTD",
	"blow chem industries ltd": "BLOW CHEM INDUSTRIES LTD",
	"jayaf": "MADHU JAYANTI INTERNATIONAL PVT LTD",
	"jayaf ltd": "MADHU JAYANTI INTERNATIONAL PVT LTD",
	"sunshine tea ltd sri lanka": "WATAWALA TEA CEYLON LTD",
	"etkaf india": "ETKAF",
	"green field fzc prc": "PROCUS LIMITED",
	"gb foods ghana ltd": "GB FOODS",
	"gb food ghana": "GB FOODS",
	"gb foods ghana": "GB FOODS",
	"zhejiang native produce & animal co.ltd china": "ZHEJIANG NATIVE PRODUCE & ANIMAL CO LTD",
	"synergy entreprises ( fze) china": "SYNERGY ENTREPRISES ( FZE)",
	"menkish impex ltd": "MENKISH IMPEX",
	"synergy entreprises (fze)": "SYNERGY ENTREPRISES ( FZE)",
	"zhejiang native produce & animal co. ltd": "ZHEJIANG NATIVE PRODUCE & ANIMAL CO LTD"
};

export function normalizeManufacturer(raw: string): string {
	if (!raw) return "";
	const clean = raw.trim().toLowerCase();
	if (MANUFACTURER_MAP[clean]) return MANUFACTURER_MAP[clean];
	
	if (clean.includes("upfield")) return "UPFIELD";
	if (clean.includes("nestle")) return "NESTLE";
	if (clean.includes("coca cola")) return "THE COCA COLA COMPANY";
	if (clean.includes("unilever")) return "UNILEVER";
	if (clean.includes("gb food")) return "GB FOODS";
	if (clean.includes("promasidor")) return "PROMASIDOR";
	if (clean.includes("menkish impex")) return "MENKISH IMPEX";
	if (clean.includes("synergy entreprises")) return "SYNERGY ENTREPRISES ( FZE)";
	if (clean.includes("zhejiang native produce")) return "ZHEJIANG NATIVE PRODUCE & ANIMAL CO LTD";
	if (clean.includes("nam viet phat")) return "NAM VIET PHAT FOOD CO. LIMITED";
	
	return raw.trim().toUpperCase();
}

export function normalizeBrand(raw: string): string {
	if (!raw) return "";
	const clean = raw.trim().toUpperCase();
	if (clean === "BEL-COLA" || clean === "BEL MALT") return "BEL";
	if (clean === "U FRESH" || clean === "U FRESH CO") return "U-FRESH";
	if (clean === "EAZZY") return "EASY";
	return clean;
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
			return normalizeBarcode(clean);
		case "MANUFACTURER":
			return normalizeManufacturer(clean);
		case "BRAND":
			return normalizeBrand(clean);
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
		if (col === "PACKAGING_TYPE") {
			result[col] = normalizePackaging(record[col] || "", record["BRAND"]);
		} else {
			result[col] = normalizeField(col, record[col]);
		}
	}

	return result;
}
