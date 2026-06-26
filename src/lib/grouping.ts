

import type { IMDBProduct } from "../types/imdb.ts";

// Regex to detect an Audit Visit ID (e.g. GH00041222, NG0123, 00041222, CH000364912)
const AUDIT_ID_REGEX = /^(?!S\d+_)[A-Z]{0,10}\d{3,}/i;

export const levenshtein = (a: string, b: string): number => {
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

export const isSafeSubstringMatch = (n: string, extN: string, brandA: string, brandB: string): boolean => {
	if (n === extN) return true;
	const isSub = extN.includes(n) || n.includes(extN);
	if (!isSub) {
		// Even when names aren't substrings of each other, same brand + long shared
		// common prefix (≥8 chars) strongly implies the same product photographed from
		// different angles (e.g. "U-FRESH ORANGE 350ML…" vs "U-FRESH ORANGE JUICE DRINK").
		if (brandA && brandB && brandA === brandB) {
			let cp = 0;
			while (cp < n.length && cp < extN.length && n[cp] === extN[cp]) cp++;
			if (cp >= Math.max(brandA.length + 3, 8)) return true;
		}
		return false;
	}
	// Safe if they explicitly share a brand
	if (brandA && brandB && brandA === brandB) return true;
	// Safe if the matched substring is substantial (avoids generic words like "drink")
	return n.length > 10 && extN.length > 10;
};

const normalizeStr = (s?: string) => {
	if (!s) return "";
	return s
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase()
		.replace(/[^a-z0-9]/g, "");
};

// Extracts the full audit ID token including any product-discriminator suffix.
// e.g. "GH000413316_A Kingsam..." → "GH000413316_A"
//      "GH000413316.A Kingsam..." → "GH000413316_A"   ← Normalized separator
//      "GH000413316_B Ena Pa..." → "GH000413316_B"   ← DIFFERENT product, must not merge
//      "GH0005109020 Kivo..."    → "GH0005109020"    ← no suffix, fuzzy OCR error handled separately
// IMPORTANT: Do NOT split on underscore or dot-suffix.
// NOTE: Only matches IDs that are at least 6 characters total (prefix + digits) to avoid
//       falsely matching short non-audit text like "R123" or "BLUE456" as audit IDs.
const getBaseAuditId = (tag?: string): string => {
	if (!tag) return "";
	const match = tag.trim().match(/^([A-Z]{0,10}\d{3,})(?:[_.-]([A-Z]))?(?:[^A-Z\d]|$)/i);
	if (match) {
		const mainId = match[1].toUpperCase();
		// Reject short IDs that are unlikely to be real audit visit IDs
		// Real audit IDs are typically 8+ characters (e.g. GH00041222, CH000364912)
		if (mainId.length < 6) return "";
		const suffix = match[2] ? match[2].toUpperCase() : "";
		return suffix ? `${mainId}_${suffix}` : mainId;
	}
	return "";
};

// Advanced normalizer specifically for image tags to strip out photographer suffixes
const normalizeTag = (s?: string) => {
	let str = normalizeStr(s);
	// Strip common suffix noise that breaks substring matching
	str = str.replace(/(firstside|secondside|thirdside|front|back|left|right|side|top|bottom)$/, "");
	return str;
};

const getSessionPrefix = (sourceImages?: string[]): string => {
	if (!sourceImages || sourceImages.length === 0) return "";
	const firstImage = sourceImages[0];
	if (!firstImage) return "";
	const filename = firstImage.split("/").pop()?.split("\\").pop() || "";
	const parts = filename.split("_");
	if (parts.length > 1 && parts[0].match(/^S\d+$/i)) {
		return parts[0].toUpperCase();
	}
	return "";
};

// Extracts the product-description portion of a raw imageTag — everything that follows the audit ID.
// e.g. "GH000413323_B Zesta Ginger 25+7 Free 57.6g Envelope Teabag box Cardboard Suiza"
//       → "zestaginger257free576genvelopeteabagboxcardboardsuiza"
// This gives us a direct signal from the WATERMARK ITSELF that two images are different products,
// without having to rely on Qwen's ITEM_NAME extraction which may be noisy.
const getTagDescription = (rawTag?: string): string => {
	if (!rawTag) return "";
	const words = rawTag.trim().split(/\s+/);
	if (words.length <= 1) return "";
	// If the first token is an audit ID, the rest is the product description
	if (AUDIT_ID_REGEX.test(words[0])) {
		return normalizeStr(words.slice(1).join(" "));
	}
	return "";
};

/**
 * Determines whether two extractions describe the same physical product (e.g. two
 * angles of one SKU, or the same SKU seen in two different batches).
 *
 * This is the single source of truth for product identity — it powers both
 * within-batch grouping (groupAndMergeImages) and cross-batch unification
 * (findCrossBatchMatch). Returns true when the pair should be treated as one product.
 */
export function productsMatch(entry: IMDBProduct, existing: IMDBProduct): boolean {
	const tag = normalizeTag(entry.imageTag);
	const barcode = normalizeStr(entry.BARCODE);
	const name = normalizeStr(entry.ITEM_NAME);
	const brand = normalizeStr(entry.BRAND);
	const auditId = getBaseAuditId(entry.imageTag);

	const extTag = normalizeTag(existing.imageTag);
	const extBarcode = normalizeStr(existing.BARCODE);
	const extName = normalizeStr(existing.ITEM_NAME);
	const extBrand = normalizeStr(existing.BRAND);
	const extAuditId = getBaseAuditId(existing.imageTag);

	// 0. Fuzzy Audit ID Guard
	// Two cases to distinguish:
	//   A) OCR digit error:   GH0005109020 vs GH0005106020 (one digit wrong in middle) → MERGE
	//   B) Product suffix:    GH000413316_A vs GH000413316_B (same audit, diff products) → BLOCK
	if (auditId && extAuditId) {
		// Extract single-letter product-discriminator suffix (e.g. _A, _B)
		const discrim = (id: string) => { const m = id.match(/_([A-Z])$/i); return m ? m[1].toUpperCase() : ""; };
		const dA = discrim(auditId);
		const dB = discrim(extAuditId);
		// If both IDs carry a single-letter discriminator and those letters differ → different products, hard block
		if (dA && dB && dA !== dB) return false;
		// Fuzzy compare the numeric base (strip any discriminator suffix before Levenshtein)
		const numBase = (id: string) => id.replace(/_[A-Z]$/i, "");
		const cleanA = numBase(auditId);
		const cleanB = numBase(extAuditId);
		const idDist = levenshtein(cleanA, cleanB);

		// Pre-compute name conflict here so the audit-ID path also respects it.
		// Two different products CAN share the same audit slot (e.g. an auditor photographed
		// two consecutive products with the same tag). If their names clearly differ, do NOT merge.
		const auditNameConflict = name && extName
			? !isSafeSubstringMatch(name, extName, brand, extBrand)
			: false;
		const auditBarcodeConflict = barcode && extBarcode && barcode.length > 8 && extBarcode.length > 8
			? levenshtein(barcode, extBarcode) > 2
			: (barcode && extBarcode && barcode !== extBarcode);

		// Compare the product-description part of the watermark text directly.
		// Two images can share the same audit ID but have DIFFERENT product descriptions
		// in the watermark (e.g. same auditor slot, two different SKUs).
		// If their watermark descriptions diverge substantially, block the merge outright —
		// this is the most reliable signal we have from the raw data.
		const descA = getTagDescription(entry.imageTag);
		const descB = getTagDescription(existing.imageTag);
		// Compare a wider window (60 chars vs 30) to catch cases where the first 30 chars
		// are identical metadata (e.g. "-retailaudit-productimages-mar-26...") but the
		// actual product description diverges after the date stamp.
		const auditTagDescConflict = descA.length > 8 && descB.length > 8
			? levenshtein(descA.substring(0, 60), descB.substring(0, 60)) > 15
			: false;

		if (idDist === 0) {
			// Exact same audit ID — check if there is a watermark description conflict
			if (auditTagDescConflict) return false;

			// If they are confirmed to be the same product (either by matching watermark descriptions or matching suffix):
			const hasSameSuffix = dA && dB && dA === dB;
			const hasMatchingWatermarkDesc = descA.length > 8 && descB.length > 8 && !auditTagDescConflict;

			if (hasSameSuffix || hasMatchingWatermarkDesc) {
				// Check brand consistency — different products sharing a project-level reference tag
				// (e.g. "D7513482-47 ..." used for an entire audit batch) should NOT be merged.
				const brandConflict = brand && extBrand && brand !== extBrand
					? !(brand.includes(extBrand) || extBrand.includes(brand) || brand.length <= 2 || extBrand.length <= 2)
					: false;
				if (brandConflict) {
					// Brands disagree — fall through to strict validation
					if (auditNameConflict || auditBarcodeConflict) return false;
					return true;
				}
				// Confirmed same product! Merge unconditionally (AI-extracted barcode/name conflicts are ignored as hallucinations)
				return true;
			}

			// Otherwise, fall back to strict validation (if we can't verify they are the same product slot via watermark text/suffix)
			if (auditNameConflict || auditBarcodeConflict) return false;
			return true;
		}

		if (idDist >= 1 && idDist <= 2) {
			// Check if they are consecutive numbers (which means different products/visits)
			const digitsA = cleanA.replace(/\D/g, "");
			const digitsB = cleanB.replace(/\D/g, "");
			if (digitsA && digitsB && digitsA.length === digitsB.length) {
				const valA = parseInt(digitsA, 10);
				const valB = parseInt(digitsB, 10);
				if (!isNaN(valA) && !isNaN(valB) && Math.abs(valA - valB) === 1) {
					// Consecutive numbers -> different products, do not merge!
					return false;
				}
			}
			// If the printed watermark descriptions agree, trust the watermark over noisy AI extraction.
			// The watermark is physically printed on the package — it's the most reliable signal.
			if (!auditTagDescConflict && descA.length > 8 && descB.length > 8) {
				return true;
			}
			// OCR digit error — only merge if AI-extracted data also agrees
			if (auditNameConflict || auditBarcodeConflict) return false;
			return true;
		}

		// different audit IDs (distance > 2) → different products
		return false;
	}

	// Helper for Conflict Detection
	const hasBarcodeConflict = barcode && extBarcode && barcode.length > 8 && extBarcode.length > 8
		? levenshtein(barcode, extBarcode) > 2
		: (barcode && extBarcode && barcode !== extBarcode);

	const hasBrandConflict = brand && extBrand && brand !== extBrand
		? !(brand.includes(extBrand) || extBrand.includes(brand) || brand.length <= 2 || extBrand.length <= 2)
		: false;

	const isSafeSubstringMatchLocal = (n: string, extN: string) => isSafeSubstringMatch(n, extN, brand, extBrand);

	const hasNameConflict = name && extName
		? !isSafeSubstringMatchLocal(name, extName)
		: false;

	// 1. Fuzzy Tag Matching (Handle "Front" / "Back" edge suffixes by checking for substrings or very low Levenshtein)
	// IMPORTANT: name conflict must be checked here too — two different products can share the
	// same audit watermark tag when an auditor photographs multiple SKUs in the same session slot.
	if (tag && extTag && tag.length > 5 && extTag.length > 5 && !hasBrandConflict && !hasBarcodeConflict && !hasNameConflict) {
		// If one string is almost entirely contained in the other
		if (tag.includes(extTag) || extTag.includes(tag)) {
			return true;
		}
		// If they are mathematically very similar overall
		if (levenshtein(tag, extTag) <= 4) {
			return true;
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
				return true;
			}
		}
	}

	// 2. Fuzzy Barcode Matching (Allow 1-2 OCR digit errors for full barcodes)
	if (barcode && extBarcode && !hasBarcodeConflict && !hasBrandConflict) return true;

	// 3. Fuzzy Item Name Matching (Substring matching, e.g. "Mok Soap" inside "Mok Fine Soap")
	if (name && extName && !hasNameConflict && !hasBrandConflict && !hasBarcodeConflict) return true;

	// 4. BRAND isolation fallback (Merge back-of-pack images into front-of-pack if no conflicts exist)
	if (brand && brand.length > 2 && extBrand === brand) {
		if (!hasBarcodeConflict && !hasNameConflict) {
			return true;
		}
	}

	// 5. Session Prefix Fallback
	// If two images share the exact same collector session prefix (e.g. S227094844),
	// and there are no barcode/brand/name conflicts, they belong to the same product.
	const entrySession = getSessionPrefix(entry.sourceImages);
	const extSession = getSessionPrefix(existing.sourceImages);
	if (entrySession && extSession && entrySession === extSession) {
		if (!hasBarcodeConflict && !hasBrandConflict && !hasNameConflict) {
			return true;
		}
	}

	return false;
}

/**
 * Cross-batch unification: finds the first prior-batch record that the same
 * identity matcher considers the same product as `record`. Used to link products
 * photographed across separate uploads/jobs without re-running the whole pipeline.
 *
 * The optional `requireStrongSignal` flag (default true) restricts cross-batch
 * links to high-trust signals (matching barcode or watermark audit ID), since
 * cross-batch matches are riskier than within-batch ones where a shared session
 * prefix or brand is enough.
 */
export function findCrossBatchMatch(
	record: IMDBProduct,
	candidates: IMDBProduct[],
	requireStrongSignal = true,
): IMDBProduct | null {
	for (const candidate of candidates) {
		if (crossBatchProductsMatch(record, candidate, requireStrongSignal)) {
			return candidate;
		}
	}
	return null;
}

/**
 * Per-pair cross-batch identity check. Combines the full grouping matcher with a
 * high-trust signal gate so cross-batch links (which can't rely on a shared upload
 * session) are only made on barcode or watermark audit-ID evidence.
 */
export function crossBatchProductsMatch(
	a: IMDBProduct,
	b: IMDBProduct,
	requireStrongSignal = true,
): boolean {
	if (!productsMatch(a, b)) return false;
	if (requireStrongSignal && !hasStrongCrossBatchSignal(a, b)) return false;
	return true;
}

/** True when two records share a high-trust identity signal (barcode or audit ID). */
function hasStrongCrossBatchSignal(a: IMDBProduct, b: IMDBProduct): boolean {
	const barcodeA = normalizeStr(a.BARCODE);
	const barcodeB = normalizeStr(b.BARCODE);
	if (barcodeA && barcodeB) {
		// Exact match accepted regardless of length
		if (barcodeA === barcodeB) {
			return true;
		}
		// Fuzzy match only for long barcodes
		if (barcodeA.length > 8 && levenshtein(barcodeA, barcodeB) <= 2) {
			return true;
		}
	}
	const auditA = getBaseAuditId(a.imageTag);
	const auditB = getBaseAuditId(b.imageTag);
	if (auditA && auditB && levenshtein(auditA, auditB) <= 2) {
		return true;
	}
	return false;
}

/**
 * Groups processed extractions using a simplified Map-based grouping strategy.
 * Primary grouping key is imageTag, fallback to BARCODE.
 */
export async function groupAndMergeImages(rawExtractions: IMDBProduct[]): Promise<IMDBProduct[]> {
	const productMap = new Map<string, IMDBProduct>();

	// Calculate information density to prioritize the best extraction
	const getDensity = (entry: IMDBProduct) => {
		let score = 0;
		Object.values(entry).forEach((v) => {
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

	for (const entry of sortedExtractions) {
		const tag = normalizeTag(entry.imageTag);
		const barcode = normalizeStr(entry.BARCODE);

		// Look for an existing group that matches ANY of these critical fields
		let foundKey: string | null = null;
		for (const [key, existing] of productMap.entries()) {
			if (productsMatch(entry, existing)) {
				foundKey = key;
				break;
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
