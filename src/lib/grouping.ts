

import type { IMDBProduct } from "../types/imdb.ts";

/**
 * Groups processed extractions using a simplified Map-based grouping strategy.
 * Primary grouping key is imageTag, fallback to BARCODE.
 */
export async function groupAndMergeImages(rawExtractions: IMDBProduct[]): Promise<IMDBProduct[]> {
	const normalizeStr = (s?: string) => (s ? s.toLowerCase().replace(/[^a-z0-9]/g, "") : "");
	const productMap = new Map<string, IMDBProduct>();

	for (const entry of rawExtractions) {
		const tag = normalizeStr(entry.imageTag);
		const barcode = normalizeStr(entry.BARCODE);
		const name = normalizeStr(entry.ITEM_NAME);

		// Look for an existing group that matches ANY of these critical fields
		let foundKey: string | null = null;
		for (const [key, existing] of productMap.entries()) {
			if (tag && tag.length > 3 && normalizeStr(existing.imageTag) === tag) { foundKey = key; break; }
			if (barcode && barcode.length > 4 && normalizeStr(existing.BARCODE) === barcode) { foundKey = key; break; }
			// If tag and barcode fail, fallback to matching exact Item Name (must be > 5 chars to avoid generic matching)
			if (name && name.length > 5 && normalizeStr(existing.ITEM_NAME) === name) { foundKey = key; break; }
		}

		// Use the found group, or create a new key prioritizing tag > barcode > filename
		const groupKey = foundKey || tag || barcode || entry.sourceImages[0] || crypto.randomUUID();

		if (!productMap.has(groupKey)) {
			// deep copy so we don't mutate the original array elements
			productMap.set(groupKey, { ...entry, sourceImages: [...entry.sourceImages] });
		} else {
			const existing = productMap.get(groupKey)!;
			// Aggregation: Fill missing fields from other images in the same group
			Object.keys(entry).forEach((key) => {
				const k = key as keyof IMDBProduct;
				if (!existing[k] && entry[k]) {
					(existing[k] as any) = entry[k];
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

