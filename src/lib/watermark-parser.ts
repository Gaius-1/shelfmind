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

/**
 * Parses raw watermark text overlay from audit photos.
 * E.g., "GH000511418 ║Mok ║Front" or "GH000413323_A ║Sister Stew 10g Pwdr Sachet China ║Front"
 * or "GH000210815 THIS WAY CHOCOLATE DRINK NUMBERS POWDER PLASTIC SACHET ATONA FOOD GHANA · Front"
 */
export function parseWatermark(raw: string): WatermarkData | null {
	if (!raw) return null;

	// Clean double spaces or weird chars
	const cleanRaw = raw.replace(/\s+/g, " ").trim();

	let auditId = "";
	let middle = "";
	let side: string | null = null;

	// 1. Try splitting by double-bar '║' or single bar '|'
	const barParts = cleanRaw.split(/[║|]/).map((p) => p.trim());
	if (barParts.length >= 3) {
		auditId = barParts[0];
		middle = barParts[1];
		side = barParts[2];
	} else if (barParts.length === 2) {
		auditId = barParts[0];
		middle = barParts[1];
	} else {
		// 2. Try splitting by dot '·' or bullet '•' or bullet '·'
		const dotParts = cleanRaw.split(/[·•\u00b7]/).map((p) => p.trim());
		if (dotParts.length >= 2) {
			const firstPart = dotParts[0];
			side = dotParts[dotParts.length - 1];

			// Split firstPart to extract auditId (first word)
			const spaceIdx = firstPart.indexOf(" ");
			if (spaceIdx !== -1) {
				auditId = firstPart.slice(0, spaceIdx).trim();
				middle = firstPart.slice(spaceIdx + 1).trim();
			} else {
				auditId = firstPart;
			}
		} else {
			// 3. Fallback to space-split
			const words = cleanRaw.split(" ");
			if (words.length > 2) {
				// Check if first word looks like Audit Visit ID
				if (words[0].toUpperCase().startsWith("GH")) {
					auditId = words[0];
					// Check if last word is a Side
					const lastWord = words[words.length - 1];
					if (/^(Front|Back|Left|Right|Top|Bottom|Barcode)$/i.test(lastWord)) {
						side = lastWord;
						middle = words.slice(1, -1).join(" ");
					} else {
						middle = words.slice(1).join(" ");
					}
				}
			}
		}
	}

	// Ensure auditId starts with GH or other expected prefix, or cleanup
	auditId = auditId.trim();
	middle = middle.trim();
	if (side) side = side.trim();

	if (!auditId && !middle) {
		return null;
	}

	// Extract side from middle if not found yet
	if (!side) {
		const sideMatch = middle.match(
			/\b(Front|Back|Left|Right|Top|Bottom|Barcode)\b/i,
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
		{ key: "gb foods", label: "GB FOODS" },
		{ key: "cb food", label: "CB FOOD" },
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
