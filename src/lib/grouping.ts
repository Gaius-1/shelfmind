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
	ocr?: string | null;
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
 * Normalizes a barcode string by removing non-digits and leading zeros.
 */
function cleanBarcode(raw: string): string {
	if (!raw) return "";
	return raw.trim().replace(/[^\d]/g, "").replace(/^0+/, "");
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
 * Helper to compute Jaccard similarity of two strings based on word tokens.
 */
function getJaccardSimilarity(str1: string, str2: string): number {
	const clean1 = (str1 || "").trim().toLowerCase();
	const clean2 = (str2 || "").trim().toLowerCase();
	if (!clean1 && !clean2) return 0;
	if (clean1 === clean2) return 1.0;

	const set1 = new Set(clean1.split(/\s+/).filter((t) => t.length > 1));
	const set2 = new Set(clean2.split(/\s+/).filter((t) => t.length > 1));
	if (set1.size === 0 || set2.size === 0) return 0;

	const intersection = new Set([...set1].filter((x) => set2.has(x)));
	const union = new Set([...set1, ...set2]);
	return intersection.size / union.size;
}

/**
 * Merges properties of multiple extractions to form a representative profile of a group.
 */
export function getGroupRepresentative<T extends GroupableExtraction>(group: T[]): T {
	const rep = { ...group[0] };
	
	// If the group has multiple items, build a combined representation
	if (group.length > 1) {
		rep.zxing = rep.zxing ? { ...rep.zxing } : null;
		rep.vision = rep.vision ? { ...rep.vision } : {};

		for (let i = 1; i < group.length; i++) {
			const item = group[i];
			if (!rep.zxing?.barcode && item.zxing?.barcode) {
				rep.zxing = { barcode: item.zxing.barcode };
			}
			if (item.vision) {
				rep.vision = { ...rep.vision, ...item.vision };
			}
			if (!rep.watermarkInfo && item.watermarkInfo) {
				rep.watermarkInfo = item.watermarkInfo;
			}
			if (item.ocr) {
				rep.ocr = (rep.ocr || "") + " " + item.ocr;
			}
		}
	}
	return rep;
}

/**
 * Computes similarity between two group representatives.
 * Returns a score between 0.0 and 1.0, where 0 means incompatible / hard blocked.
 */
export function computeGroupSimilarity<T extends GroupableExtraction>(
	a: T,
	b: T,
): number {
	const aAuditId = a.watermarkInfo?.auditId || "";
	const bAuditId = b.watermarkInfo?.auditId || "";

	// 0. Same Watermark Audit ID (Ultimate ground truth match)
	if (aAuditId && bAuditId && aAuditId === bAuditId) {
		return 1.0;
	}

	const aBarcode = cleanBarcode(a.zxing?.barcode || a.vision?.BARCODE || "");
	const bBarcode = cleanBarcode(b.zxing?.barcode || b.vision?.BARCODE || "");

	// 1. Barcode Match (Strongest signal)
	if (aBarcode && bBarcode && aBarcode === bBarcode) {
		return 1.0;
	}

	// Hard Blockers
	// A. Barcode conflict
	if (aBarcode && bBarcode && aBarcode !== bBarcode) {
		return 0;
	}

	// B. Watermark Audit ID conflict
	if (aAuditId && bAuditId && aAuditId !== bAuditId) {
		return 0;
	}

	// C. Weight Blocker (Crucial constraint)
	const aWeight = normalizeWeight(
		a.watermarkInfo?.weight || a.vision?.WEIGHT || "",
	);
	const bWeight = normalizeWeight(
		b.watermarkInfo?.weight || b.vision?.WEIGHT || "",
	);
	if (aWeight && bWeight && aWeight !== bWeight) {
		return 0;
	}

	// D. Manufacturer Blocker
	const aManuf = a.watermarkInfo?.manufacturer || a.vision?.MANUFACTURER || "";
	const bManuf = b.watermarkInfo?.manufacturer || b.vision?.MANUFACTURER || "";
	if (
		aManuf &&
		bManuf &&
		normalizeGroupKey(aManuf) !== normalizeGroupKey(bManuf)
	) {
		return 0;
	}

	// Semantic overlaps
	const aBrand = a.vision?.BRAND || "";
	const bBrand = b.vision?.BRAND || "";
	const aItem = a.vision?.ITEM_NAME || "";
	const bItem = b.vision?.ITEM_NAME || "";

	const brandSim = getJaccardSimilarity(aBrand, bBrand);
	const itemSim = getJaccardSimilarity(aItem, bItem);

	const aDesc = a.watermarkInfo?.productDescription || a.productGroupKey || "";
	const bDesc = b.watermarkInfo?.productDescription || b.productGroupKey || "";
	const descSim =
		normalizeGroupKey(aDesc) === normalizeGroupKey(bDesc)
			? 1.0
			: getJaccardSimilarity(aDesc, bDesc);

	const ocrSim = getJaccardSimilarity(a.ocr || "", b.ocr || "");

	// Weighted similarity score
	let score = 0;
	let weights = 0;

	if (aBrand || bBrand) {
		score += brandSim * 0.4;
		weights += 0.4;
	}
	if (aItem || bItem) {
		score += itemSim * 0.4;
		weights += 0.4;
	}
	if (aDesc || bDesc) {
		score += descSim * 0.5;
		weights += 0.5;
	}
	if (a.ocr || b.ocr) {
		score += ocrSim * 0.2;
		weights += 0.2;
	}

	// Boost score if sequential store visit filenames
	const fnA = parseFilename(a.fileName);
	const fnB = parseFilename(b.fileName);
	if (fnA && fnB && fnA.storeId === fnB.storeId) {
		const dist = Math.abs(fnA.imageId - fnB.imageId);
		if (dist <= 3) {
			// Massive boost to ensure sequential photos of the same item bypass the side conflict blocker
			score += 0.5;
			weights += 0.5;
		}
	}

	return weights > 0 ? score / weights : 0;
}

/**
 * Checks if two groups have conflicting sides (e.g. both already contain a Front,
 * or both already contain a Back/Side), preventing them from merging.
 */
function hasConflictingSides<T extends GroupableExtraction>(
	groupA: T[],
	groupB: T[],
): boolean {
	const auditA = groupA.map((x) => x.watermarkInfo?.auditId).find((id) => !!id);
	const auditB = groupB.map((x) => x.watermarkInfo?.auditId).find((id) => !!id);

	// If they share the same non-empty audit ID, allow them to merge
	if (auditA && auditB && auditA === auditB) {
		return false;
	}

	const isFront = (side: string) => side.toLowerCase() === "front";
	const isBack = (side: string) =>
		[
			"back",
			"left",
			"right",
			"top",
			"bottom",
			"barcode",
			"first_side",
			"second_side",
			"side_1",
			"side_2",
		].includes(side.toLowerCase());

	const getSides = (group: T[]) =>
		group.map((x) => x.watermarkInfo?.side || x.vision?.SIDE || "");

	const sidesA = getSides(groupA);
	const sidesB = getSides(groupB);

	const hasFrontA = sidesA.some(isFront);
	const hasFrontB = sidesB.some(isFront);
	if (hasFrontA && hasFrontB) return true;

	const hasBackA = sidesA.some(isBack);
	const hasBackB = sidesB.some(isBack);
	if (hasBackA && hasBackB) return true;

	return false;
}

/**
 * Groups processed extractions using a Greedy Bipartite Matcher.
 */
export function groupExtractions<T extends GroupableExtraction>(
	extractions: T[],
): Record<string, T[]> {
	if (extractions.length === 0) return {};

	// 1. Initial State: place each extraction in its own list
	const activeGroups: T[][] = extractions.map((ext) => [ext]);

	// 2. Greedy Matching Loop
	const similarityThreshold = 0.35;
	let iterations = 0;
	const maxIterations = extractions.length * extractions.length;

	while (activeGroups.length > 1 && iterations < maxIterations) {
		iterations++;
		let bestPair: [number, number] | null = null;
		let bestScore = -1;

		// Find pair of groups with highest similarity score
		for (let i = 0; i < activeGroups.length; i++) {
			for (let j = i + 1; j < activeGroups.length; j++) {
				const repA = getGroupRepresentative(activeGroups[i]);
				const repB = getGroupRepresentative(activeGroups[j]);
				const score = computeGroupSimilarity(repA, repB);
				// Apply group-wide side conflict blocker, EXCEPT when there is a barcode match, audit ID match, or sequential filename connection
				if (hasConflictingSides(activeGroups[i], activeGroups[j])) {
					const aBarcode = cleanBarcode(repA.zxing?.barcode || repA.vision?.BARCODE || "");
					const bBarcode = cleanBarcode(repB.zxing?.barcode || repB.vision?.BARCODE || "");
					const hasBarcodeMatch = aBarcode && bBarcode && aBarcode === bBarcode;

					const aAuditId = repA.watermarkInfo?.auditId || "";
					const bAuditId = repB.watermarkInfo?.auditId || "";
					const hasAuditMatch = aAuditId && bAuditId && aAuditId === bAuditId;

					const fnA = parseFilename(repA.fileName);
					const fnB = parseFilename(repB.fileName);
					const isSequential = !!(fnA && fnB && fnA.storeId === fnB.storeId && Math.abs(fnA.imageId - fnB.imageId) <= 3);

					if (!hasBarcodeMatch && !hasAuditMatch && !isSequential) {
						continue;
					}
				}

				if (score > bestScore) {
					bestScore = score;
					bestPair = [i, j];
				}
			}
		}

		// If no compatible pair passes threshold, stop merging
		if (bestPair === null || bestScore < similarityThreshold) {
			break;
		}

		// Merge group j into group i
		const [idxI, idxJ] = bestPair;
		activeGroups[idxI] = [...activeGroups[idxI], ...activeGroups[idxJ]];

		// Remove group j
		activeGroups.splice(idxJ, 1);
	}

	// 3. Compile output dictionary
	const groups: Record<string, T[]> = {};
	for (const group of activeGroups) {
		const rep = getGroupRepresentative(group);
		const extBarcode = cleanBarcode(rep.zxing?.barcode || rep.vision?.BARCODE || "");
		const extDesc =
			rep.watermarkInfo?.productDescription || rep.productGroupKey || "";
		const extDescKey = normalizeGroupKey(extDesc);
		const uniqueId = rep.fileName.split(".")[0];

		const extAuditId = rep.watermarkInfo?.auditId || "";

		// Assign a stable key for this group
		let groupKey = "";
		if (extAuditId) {
			groupKey = `audit_${extAuditId}`;
		} else if (extBarcode) {
			groupKey = `barcode_${extBarcode}`;
		} else if (extDescKey) {
			groupKey = `${extDescKey}__${uniqueId}`;
		} else {
			groupKey = uniqueId;
		}

		groups[groupKey] = group;
	}

	return groups;
}
