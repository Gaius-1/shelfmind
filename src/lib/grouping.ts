

import type { IMDBProduct } from "../types/imdb.ts";

/**
 * Groups processed extractions using a simplified Map-based grouping strategy.
 * Primary grouping key is imageTag, fallback to BARCODE.
 */
export async function groupAndMergeImages(rawExtractions: IMDBProduct[]): Promise<IMDBProduct[]> {
	const productMap = new Map<string, IMDBProduct>();

	for (const entry of rawExtractions) {
		// Use Image Tag or Barcode as the primary grouping key.
		// CRITICAL FALLBACK: If Qwen fails to extract both, do NOT drop the image. Group it by its own filename so it can be flagged in the Review Queue.
		const groupKey = entry.imageTag || entry.BARCODE || entry.sourceImages[0] || crypto.randomUUID();

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

