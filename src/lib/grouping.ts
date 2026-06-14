import { normalizeWeight } from "./normalization.ts";

/**
 * Signal priority constants for grouping decisions.
 *
 * Barcode (1.0) > Weight/Volume blocker (0.95) > Name Tag OCR (0.85) > Visual similarity (0.65)
 */
export const GROUPING_SIGNAL_PRIORITY = {
	BARCODE: 1.0,
	WEIGHT_BLOCKER: 0.95,
	NAME_TAG_OCR: 0.85,
	VISUAL_SIMILARITY: 0.65,
} as const;

/** Minimal extraction shape required by the grouping module. */
export type GroupableExtraction = {
	fileName: string;
	productGroupKey: string;
	zxing: { barcode: string | null } | null;
	vision: Partial<Record<string, string>> | null;
	watermarkInfo?: {
		auditId: string;
		productDescription: string;
		weight: string | null;
		packaging: string | null;
		manufacturer: string | null;
		country: string | null;
		side: string | null;
	} | null;
};

/**
 * Normalizes the product group key to a comparable string.
 */
function normalizeGroupKey(raw: string): string {
	return raw
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]/g, "");
}

/**
 * Parses store ID and image sequence ID from a filename like S221234199_550719011.jpg
 */
function parseFilename(
	name: string,
): { storeId: string; imageId: number } | null {
	const match = name.match(/^S(\d+)_(\d+)/i);
	return match ? { storeId: match[1], imageId: parseInt(match[2], 10) } : null;
}

/**
 * Groups an array of extractions by combining:
 * 1. Barcode Matches (1.0)
 * 2. Watermark Description Matches (0.85)
 * 3. Filename Proximity (0.40) - for images from the same store visit within 3 frames
 * 4. Weight Blocker (0.95) - prevents merging different weights/sizes.
 */
export function groupExtractions<T extends GroupableExtraction>(
	extractions: T[],
): Record<string, T[]> {
	const groups: Record<string, T[]> = {};

	for (const ext of extractions) {
		const extBarcode = ext.zxing?.barcode || ext.vision?.BARCODE || "";
		const extWeight = normalizeWeight(ext.vision?.WEIGHT ?? "");
		const extAuditId = ext.watermarkInfo?.auditId || "";
		const extDesc =
			ext.watermarkInfo?.productDescription || ext.productGroupKey || "";
		const extDescKey = normalizeGroupKey(extDesc);
		const fnInfo = parseFilename(ext.fileName);

		let assignedKey = "";

		// Compare against existing groups
		for (const [groupKey, groupExts] of Object.entries(groups)) {
			const rep = groupExts[0];
			const repBarcode = rep.zxing?.barcode || rep.vision?.BARCODE || "";
			const repWeight = normalizeWeight(rep.vision?.WEIGHT ?? "");
			const repAuditId = rep.watermarkInfo?.auditId || "";
			const repDesc =
				rep.watermarkInfo?.productDescription || rep.productGroupKey || "";
			const repDescKey = normalizeGroupKey(repDesc);
			const repFnInfo = parseFilename(rep.fileName);

			// 1. Weight Blocker
			if (extWeight && repWeight && extWeight !== repWeight) {
				continue;
			}

			// 2. Barcode Match (Strongest signal)
			if (extBarcode && repBarcode && extBarcode === repBarcode) {
				assignedKey = groupKey;
				break;
			}

			// 3. Exact Normalized Watermark Product Description Match
			if (extDescKey && repDescKey && extDescKey === repDescKey) {
				assignedKey = groupKey;
				break;
			}

			// 4. Filename Proximity Match (Within same store visit, sequential images)
			if (extAuditId && repAuditId && extAuditId === repAuditId) {
				if (fnInfo && repFnInfo && fnInfo.storeId === repFnInfo.storeId) {
					const dist = Math.abs(fnInfo.imageId - repFnInfo.imageId);
					if (dist <= 3) {
						// Sequential images in the same visit, make sure they don't have conflicting descriptions
						if (extDescKey && repDescKey && extDescKey !== repDescKey) {
							continue;
						}
						assignedKey = groupKey;
						break;
					}
				}
			}
		}

		// Fallback: create a new group key
		if (!assignedKey) {
			const uniqueId = ext.fileName.split(".")[0];
			assignedKey = extDescKey ? `${extDescKey}__${uniqueId}` : uniqueId;
		}

		if (!groups[assignedKey]) {
			groups[assignedKey] = [];
		}
		groups[assignedKey].push(ext);
	}

	return groups;
}
