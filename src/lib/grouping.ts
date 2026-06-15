

import type { IMDBProduct } from "../types/imdb.ts";

/**
 * Groups processed extractions using a simplified Map-based grouping strategy.
 * Primary grouping key is imageTag, fallback to BARCODE.
 */
export async function groupAndMergeImages(rawExtractions: IMDBProduct[]): Promise<IMDBProduct[]> {
	const normalizeStr = (s?: string) => (s ? s.toLowerCase().replace(/[^a-z0-9]/g, "") : "");
	const productMap = new Map<string, IMDBProduct>();

	// Calculate information density to prioritize the best extraction
	const getDensity = (entry: IMDBProduct) => {
		let score = 0;
		Object.entries(entry).forEach(([k, v]) => {
			if (typeof v === "string" && v.length > 0) score++;
		});
		return score;
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
		const tag = normalizeStr(entry.imageTag);
		const barcode = normalizeStr(entry.BARCODE);
		const name = normalizeStr(entry.ITEM_NAME);
		const brand = normalizeStr(entry.BRAND);

		// Look for an existing group that matches ANY of these critical fields
		let foundKey: string | null = null;
		for (const [key, existing] of productMap.entries()) {
			const extTag = normalizeStr(existing.imageTag);
			const extBarcode = normalizeStr(existing.BARCODE);
			const extName = normalizeStr(existing.ITEM_NAME);
			const extBrand = normalizeStr(existing.BRAND);

			// 1. Exact Tag Matching
			if (tag && tag.length > 3 && extTag === tag) { foundKey = key; break; }
			
			// 2. Fuzzy Barcode Matching (Allow 1-2 OCR digit errors for full barcodes)
			if (barcode && barcode.length > 8 && extBarcode && extBarcode.length > 8) {
				if (levenshtein(barcode, extBarcode) <= 2) { foundKey = key; break; }
			} else if (barcode && barcode.length > 4 && extBarcode === barcode) {
				foundKey = key; break; // Exact match fallback for short barcodes
			}

			// 3. Fuzzy Item Name Matching (Substring matching, e.g. "Mok Soap" inside "Mok Fine Soap")
			if (name && name.length > 4 && extName && extName.length > 4) {
				if (extName.includes(name) || name.includes(extName)) { foundKey = key; break; }
			}

			// 4. BRAND isolation fallback (If both are unreadable but belong to same isolated brand)
			if (brand && brand.length > 3 && extBrand === brand) {
				// Only group by brand if they don't have conflicting barcodes/names
				if (!barcode && !extBarcode && !name && !extName) {
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
			// Aggregation: Keep the most descriptive (longest) string for text fields
			Object.keys(entry).forEach((key) => {
				const k = key as keyof IMDBProduct;
				if (k === 'sourceImages' || k === 'rawVisionData') return;
				
				const existingVal = existing[k];
				const newVal = entry[k];

				if (typeof newVal === "string") {
					// Use descriptive length heuristic: longer text usually means fewer dropped characters
					if (!existingVal || (typeof existingVal === "string" && newVal.length > existingVal.length)) {
						(existing[k] as any) = newVal;
					}
				} else if (!existingVal && newVal) {
					(existing[k] as any) = newVal;
				}
			});
			existing.sourceImages.push(...entry.sourceImages);
			if (entry.rawVisionData) {
				existing.rawVisionData = { ...existing.rawVisionData, ...entry.rawVisionData };
			}
		}
	}
	return Array.from(productMap.values());
}

