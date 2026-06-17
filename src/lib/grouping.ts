

import type { IMDBProduct } from "../types/imdb.ts";

/**
 * Groups processed extractions using a simplified Map-based grouping strategy.
 * Primary grouping key is imageTag, fallback to BARCODE.
 */
export async function groupAndMergeImages(rawExtractions: IMDBProduct[]): Promise<IMDBProduct[]> {
	const normalizeStr = (s?: string) => (s ? s.toLowerCase().replace(/[^a-z0-9]/g, "") : "");
	
	// Advanced normalizer specifically for image tags to strip out photographer suffixes
	const normalizeTag = (s?: string) => {
		let str = normalizeStr(s);
		// Strip common suffix noise that breaks substring matching
		str = str.replace(/(firstside|secondside|thirdside|front|back|left|right|side|top|bottom)$/, "");
		return str;
	};

	const productMap = new Map<string, IMDBProduct>();

	// Calculate information density to prioritize the best extraction
	const getDensity = (entry: IMDBProduct) => {
		let score = 0;
		Object.entries(entry).forEach(([k, v]) => {
			if (typeof v === "string" && v.length > 0) score++;
		});
		return score;
	};

	// Side-aware confidence boost: trust the right side for the right fields
	const FRONT_FIELDS = new Set(["ITEM_NAME", "BRAND", "WEIGHT", "VARIANT", "TAGLINE"]);
	const BACK_FIELDS  = new Set(["MANUFACTURER", "COUNTRY", "ADDONS", "PROMOTION"]);
	const BARCODE_FIELDS = new Set(["BARCODE"]);

	const getSideBoost = (side: string | undefined, field: string): number => {
		if (!side) return 0;
		const s = side.toLowerCase();
		if (s === "front"   && FRONT_FIELDS.has(field))   return 0.10;
		if (s === "back"    && BACK_FIELDS.has(field))    return 0.10;
		if (s === "barcode" && BARCODE_FIELDS.has(field)) return 0.15;
		return 0;
	};

	// Sort by highest density first so the clearest image dictates the base record
	const sortedExtractions = [...rawExtractions].sort((a, b) => getDensity(b) - getDensity(a));

	// Helper: Levenshtein distance for fuzzy barcode matching
	const levenshtein = (a: string, b: string): number => {
		if (a.length === 0) return b.length;
		if (b.length === 0) return a.length;
		const matrix = Array.from({ length: b.length + 1 }, (_, i) => [i]);
		for (let j = 1; j <= a.length; j++) matrix[0][j] = j;
		for (let i = 1; i <= b.length; i++) {
			for (let j = 1; j <= a.length; j++) {
				if (b.charAt(i - 1) === a.charAt(j - 1)) {
					matrix[i][j] = matrix[i - 1][j - 1];
				} else {
					matrix[i][j] = Math.min(
						matrix[i - 1][j - 1] + 1,
						Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1)
					);
				}
			}
		}
		return matrix[b.length][a.length];
	};

	for (const entry of sortedExtractions) {
		const tag = normalizeTag(entry.imageTag);
		const barcode = normalizeStr(entry.BARCODE);
		const name = normalizeStr(entry.ITEM_NAME);
		const brand = normalizeStr(entry.BRAND);

		// Look for an existing group that matches ANY of these critical fields
		let foundKey: string | null = null;
		for (const [key, existing] of productMap.entries()) {
			const extTag = normalizeTag(existing.imageTag);
			const extBarcode = normalizeStr(existing.BARCODE);
			const extName = normalizeStr(existing.ITEM_NAME);
			const extBrand = normalizeStr(existing.BRAND);

			// Helper for Conflict Detection
			const hasBarcodeConflict = barcode && extBarcode && barcode.length > 8 && extBarcode.length > 8 
				? levenshtein(barcode, extBarcode) > 2 
				: (barcode && extBarcode && barcode !== extBarcode);
				
			const hasBrandConflict = brand && extBrand && brand !== extBrand;

			const isSafeSubstringMatch = (n: string, extN: string) => {
				if (n === extN) return true;
				const isSub = extN.includes(n) || n.includes(extN);
				if (!isSub) return false;
				// Safe if they explicitly share a brand
				if (brand && extBrand && brand === extBrand) return true;
				// Safe if the matched substring is substantial (avoids generic words like "drink")
				return n.length > 10 && extN.length > 10;
			};

			const hasNameConflict = name && extName 
				? !isSafeSubstringMatch(name, extName)
				: false;

			// 1. Fuzzy Tag Matching (Handle "Front" / "Back" edge suffixes by checking for substrings or very low Levenshtein)
			if (tag && extTag && tag.length > 5 && extTag.length > 5 && !hasBrandConflict && !hasBarcodeConflict) {
				// If one string is almost entirely contained in the other
				if (tag.includes(extTag) || extTag.includes(tag)) {
					foundKey = key; break;
				}
				// If they are mathematically very similar overall
				if (levenshtein(tag, extTag) <= 4) {
					foundKey = key; break;
				}
				
				// Advanced: Tokenized Prefix Matching
				// Data collectors often print "ID NAME SUFFIX". We extract the ID (first block of alphanumeric chars)
				// Since normalizeTag removes spaces, we use the original imageTag to find the first token
				const getPrefixToken = (s?: string) => s ? s.trim().split(/[\s_]+/)[0].toLowerCase() : "";
				const prefixA = getPrefixToken(entry.imageTag);
				const prefixB = getPrefixToken(existing.imageTag);
				
				if (prefixA && prefixB && prefixA.length > 6 && prefixB.length > 6) {
					// If the tracking IDs are mathematically almost identical (e.g. COABBOU... vs COABIBOU...)
					if (levenshtein(prefixA, prefixB) <= 2) {
						foundKey = key; break;
					}
				}
			}
			
			// 2. Fuzzy Barcode Matching (Allow 1-2 OCR digit errors for full barcodes)
			if (barcode && extBarcode && !hasBarcodeConflict && !hasBrandConflict) { foundKey = key; break; }

			// 3. Fuzzy Item Name Matching (Substring matching, e.g. "Mok Soap" inside "Mok Fine Soap")
			if (name && extName && !hasNameConflict && !hasBrandConflict && !hasBarcodeConflict) { foundKey = key; break; }

			// 4. BRAND isolation fallback (Merge back-of-pack images into front-of-pack if no conflicts exist)
			if (brand && brand.length > 2 && extBrand === brand) {
				if (!hasBarcodeConflict && !hasNameConflict) {
					foundKey = key; break;
				}
			}
		}

		// Use the found group, or create a new key prioritizing tag > barcode > filename
		const groupKey = foundKey || tag || barcode || entry.sourceImages[0] || crypto.randomUUID();

		if (!productMap.has(groupKey)) {
			// deep copy so we don't mutate the original array elements
			productMap.set(groupKey, { ...entry, sourceImages: [...entry.sourceImages] });
		} else {
			const existing = productMap.get(groupKey)!;
			// Aggregation: Keep the most confident extraction, fallback to longest string
			Object.keys(entry).forEach((key) => {
				const k = key as keyof IMDBProduct;
				if (k === 'sourceImages' || k === 'rawVisionData' || k === 'fieldConfidence' || k === 'imageSide') return;
				
				const existingVal = existing[k];
				const newVal = entry[k];

				const existingConf = existing.fieldConfidence?.[k] ?? 0;
				const newConf = entry.fieldConfidence?.[k] ?? 0;

				// Apply side-label boost: if incoming or existing has a side that matches this field, boost its confidence
				const boostedNewConf = newConf + getSideBoost((entry as any).imageSide, k as string);
				const boostedExistingConf = existingConf + getSideBoost((existing as any).imageSide, k as string);

				// 1. AI Confidence Driven Merge (with side boost)
				if (boostedExistingConf > 0 || boostedNewConf > 0) {
					if (boostedNewConf > boostedExistingConf) {
						(existing[k] as any) = newVal;
						if (!existing.fieldConfidence) existing.fieldConfidence = {};
						existing.fieldConfidence[k] = newConf; // store raw conf, boost is transient
					}
				} 
				// 2. Length Heuristic Fallback
				else if (typeof newVal === "string") {
					if (!existingVal || (typeof existingVal === "string" && newVal.length > existingVal.length)) {
						(existing[k] as any) = newVal;
					}
				} 
				// 3. Simple Fallback
				else if (!existingVal && newVal) {
					(existing[k] as any) = newVal;
				}
			});
			existing.sourceImages = Array.from(new Set([...existing.sourceImages, ...entry.sourceImages]));
			if (entry.rawVisionData) {
				existing.rawVisionData = { ...existing.rawVisionData, ...entry.rawVisionData };
			}
		}
	}
	return Array.from(productMap.values());
}

