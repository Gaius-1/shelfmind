import {
	normalizeWeight,
	normalizePackaging,
	normalizeCountry,
} from "./normalization.ts";

export interface WatermarkData {
	auditId: string;
	productDescription: string; // The full product info string
	weight: string | null;
	packaging: string | null;
	manufacturer: string | null;
	country: string | null;
	side: string | null;
}

// Regex to detect an Audit Visit ID (e.g. GH00041222, NG0123, 00041222, CH000364912)
const AUDIT_ID_REGEX = /^(?!S\d+_)[A-Z]{0,10}\d{3,}/i;

/**
 * Parses raw watermark text overlay from audit photos.
 * E.g., "GH000511418 ║Mok ║Front" or "GH000413323_A ║Sister Stew 10g Pwdr Sachet China ║Front"
 * or "GH000210815 THIS WAY CHOCOLATE DRINK NUMBERS POWDER PLASTIC SACHET ATONA FOOD GHANA · Front"
 * or "CH000364912 U-FRESH ORANGE 350ML BOTTLE PLASTIC U-FRESH COMPANY LIMITED First_Side"
 */
export function parseWatermark(raw: string): WatermarkData | null {
	if (!raw) return null;

	// Clean double spaces or weird chars
	const cleanRaw = raw.replace(/\s+/g, " ").trim();

	let auditId = "";
	let middle = "";
	let side: string | null = null;

	const SIDE_REGEX = /^(Front|Back|Left|Right|Top|Bottom|Barcode|First_Side|Second_Side|Side_1|Side_2)$/i;

	/**
	 * Given a raw text chunk, extract the audit ID from the beginning if present.
	 * Returns [auditId, remainder].
	 */
	function extractAuditId(text: string): [string, string] {
		const words = text.split(" ");
		if (words.length > 0 && AUDIT_ID_REGEX.test(words[0])) {
			return [words[0], words.slice(1).join(" ")];
		}
		return ["", text];
	}

	// 1. Try splitting by double-bar '║' or single bar '|'
	const barParts = cleanRaw.split(/[║|]/).map((p) => p.trim());
	if (barParts.length >= 3) {
		// "GH000511418 | Mok | Front"
		auditId = barParts[0];
		middle = barParts[1];
		side = barParts[2];
	} else if (barParts.length === 2) {
		// Could be "GH000511418 Mok | Front" or "Mok | Front"
		const [extractedId, remainder] = extractAuditId(barParts[0]);
		auditId = extractedId;
		middle = remainder || barParts[0];
		side = barParts[1];
	} else {
		// 2. Try splitting by dot '·' or bullet '•'
		const dotParts = cleanRaw.split(/[·•\u00b7]/).map((p) => p.trim());
		if (dotParts.length >= 2) {
			side = dotParts[dotParts.length - 1];
			const firstPart = dotParts.slice(0, -1).join(" ");
			const [extractedId, remainder] = extractAuditId(firstPart);
			auditId = extractedId;
			middle = remainder;
		} else {
			// 3. Fallback to space-split
			const words = cleanRaw.split(" ");
			if (words.length > 1) {
				let startIdx = 0;
				if (AUDIT_ID_REGEX.test(words[0])) {
					auditId = words[0];
					startIdx = 1;
				}
				const lastWord = words[words.length - 1];
				if (SIDE_REGEX.test(lastWord)) {
					side = lastWord;
					middle = words.slice(startIdx, -1).join(" ");
				} else {
					middle = words.slice(startIdx).join(" ");
				}
			} else {
				middle = cleanRaw;
			}
		}
	}

	middle = middle.trim();
	if (side) side = side.trim();

	if (!middle) {
		return null;
	}

	// Extract side from middle if not found yet
	if (!side) {
		const sideMatch = middle.match(
			/\b(Front|Back|Left|Right|Top|Bottom|Barcode|First_Side|Second_Side|Side_1|Side_2)\b/i,
		);
		if (sideMatch) {
			side = sideMatch[1];
			middle = middle.replace(sideMatch[0], "").trim();
		}
	}

	// Extract weight/volume
	let weight: string | null = null;
	const weightRegex =
		/\b(\d+(?:\.\d+)?)\s*(g|kg|ml|l|grams|grams?|kilograms?|liters?|litres?|millilitres?|milliliters?|pcs|pack|pk|oz)\b/i;
	const weightMatch = middle.match(weightRegex);
	if (weightMatch) {
		weight = normalizeWeight(weightMatch[0]);
	}

	// Extract packaging type
	let packaging: string | null = null;
	const packagingKeywords = [
		"jar",
		"sachet",
		"pouch",
		"bottle",
		"can",
		"tin",
		"box",
		"carton",
		"pack",
		"packet",
		"tub",
		"tube",
		"bag",
		"wrapper",
		"wrap",
		"glass jar",
		"plastic bottle",
		"plastic tub",
		"plastic sachet",
	];
	for (const kw of packagingKeywords) {
		const regex = new RegExp(`\\b${kw}s?\\b`, "i");
		if (regex.test(middle)) {
			packaging = normalizePackaging(kw);
			break;
		}
	}

	// Extract country
	let country: string | null = null;
	const countryKeywords = [
		"ghana",
		"belgium",
		"china",
		"india",
		"uae",
		"united arab emirates",
		"cote d'ivoire",
		"ivory coast",
		"burkina faso",
		"nigeria",
		"kenya",
		"south africa",
	];
	for (const c of countryKeywords) {
		const regex = new RegExp(`\\b${c}\\b`, "i");
		if (regex.test(middle)) {
			country = normalizeCountry(c);
			break;
		}
	}

	// Extract manufacturer (common West African/multinational ones in this dataset)
	let manufacturer: string | null = null;
	const manufacturerKeywords = [
		{ key: "upfield", label: "UPFIELD" },
		{ key: "ajc trading", label: "AJC TRADING CO LTD" },
		{ key: "atona food", label: "ATONA FOOD" },
		{ key: "unilever", label: "UNILEVER" },
		{ key: "nestle", label: "NESTLE" },
		{ key: "cadbury", label: "CADBURY" },
		{ key: "promasidor", label: "PROMASIDOR" },
		{ key: "gb food", label: "GB FOODS" },
		{ key: "cb food", label: "CB FOOD" },
		{ key: "al ain", label: "AL AIN COMPANY LTD" },
		{ key: "coca cola", label: "THE COCA COLA COMPANY" },
		{ key: "fagip", label: "FAGIP VENTURES" },
		{ key: "nutrifoods", label: "NUTRIFOODS" },
		{ key: "sister sardine", label: "SISTER SARDINE & MACKEREL VENTURES" },
		{ key: "u fresh", label: "U-FRESH ENTERPRISES" },
		{ key: "u-fresh", label: "U-FRESH ENTERPRISES" },
		{ key: "aqfrsh", label: "AQUAFRESH LIMITED" },
		{ key: "aquafresh", label: "AQUAFRESH LIMITED" },
		{ key: "nam viet phat", label: "NAM VIET PHAT FOOD CO. LIMITED" },
		{ key: "b-diet", label: "B-DIET LTD" },
		{ key: "senico", label: "SENICO" },
		{ key: "diakite ramta", label: "SENICO" },
		{ key: "c'propre", label: "C'PROPRE" },
		{ key: "homepro", label: "HOMEPRO COMPANY LTD" },
		{ key: "sunda purecare", label: "HOMEPRO COMPANY LTD" },
		{ key: "lgd", label: "LGD LIMITED" },
		{ key: "meiji ghana", label: "LGD LIMITED" },
		{ key: "sdtm", label: "S.D.T.M" },
		{ key: "s\\.d\\.t\\.m", label: "S.D.T.M" },
		{ key: "africa consumer products", label: "AFRICAN CONSUMER PRODUCTS" },
		{ key: "blow chem", label: "BLOW CHEM INDUSTRIES LTD" },
		{ key: "blow-chem", label: "BLOW CHEM INDUSTRIES LTD" },
		{ key: "madhu jayanti", label: "MADHU JAYANTI INTERNATIONAL PVT LTD" },
		{ key: "jayaf", label: "MADHU JAYANTI INTERNATIONAL PVT LTD" },
		{ key: "watawala tea", label: "WATAWALA TEA CEYLON LTD" },
		{ key: "sunshine tea", label: "WATAWALA TEA CEYLON LTD" },
		{ key: "etkaf", label: "ETKAF" },
		{ key: "procus", label: "PROCUS LIMITED" },
		{ key: "green field fzc", label: "PROCUS LIMITED" },
		{ key: "zhejiang", label: "ZHEJIANG NATIVE PRODUCE & ANIMAL CO LTD" },
		{ key: "synergy", label: "SYNERGY ENTREPRISES ( FZE)" },
		{ key: "menkish", label: "MENKISH IMPEX" },
	];
	for (const m of manufacturerKeywords) {
		const regex = new RegExp(`\\b${m.key}\\b`, "i");
		if (regex.test(middle)) {
			manufacturer = m.label;
			break;
		}
	}

	return {
		auditId,
		productDescription: middle,
		weight,
		packaging,
		manufacturer,
		country,
		side,
	};
}
