import { readBarcodesFromImageFile } from "zxing-wasm";
import { db } from "../db/index.ts";
import { jobs, imdbRecords, duplicatePairs } from "../db/schema.ts";
import { eq, and, ne } from "drizzle-orm";
import { join } from "path";
import { existsSync } from "fs";
import {
	IMDB_COLUMNS,
	FIELD_WEIGHTS,
	CONFIDENCE_THRESHOLD,
	FIELD_EMPTY_THRESHOLD,
	type ImdbColumnName,
	type FieldMeta,
	type RawExtraction,
	type RawExtractionPerImage,
	type ImdbRecord,
	type ExtractionSource,
} from "../types/imdb.ts";
import { normalizeRecord, normalizeField } from "./normalization.ts";
import { getUpload } from "./storage.ts";
import { groupExtractions, computeGroupSimilarity } from "./grouping.ts";
import { getBinding } from "./cloudflare.ts";
import { parseWatermark } from "./watermark-parser.ts";

export class JobReporter {
	private stub: any = null;

	constructor(env: any, jobId: string) {
		if (env && env.JOB_COORDINATOR) {
			try {
				const id = env.JOB_COORDINATOR.idFromName(jobId);
				this.stub = env.JOB_COORDINATOR.get(id);
			} catch (err) {
				console.warn("[Pipeline] Could not resolve JOB_COORDINATOR binding");
			}
		}
	}

	async updateNodeState(
		nodeId: string,
		status: string,
		processedCount?: number,
		totalCount?: number,
		badge?: string,
	) {
		if (!this.stub) return;
		try {
			await this.stub.updateNodeState(
				nodeId,
				status as any,
				processedCount,
				totalCount,
				badge,
			);
		} catch (e) {
			console.warn("[Reporter] Failed to update node state:", e);
		}
	}

	async updateEdgeState(edgeId: string, animated: boolean, color: string) {
		if (!this.stub) return;
		try {
			await this.stub.updateEdgeState(edgeId, animated, color);
		} catch (e) {
			console.warn("[Reporter] Failed to update edge state:", e);
		}
	}

	async addLog(
		nodeId: string,
		message: string,
		logType: "info" | "success" | "warning" | "error",
	) {
		if (!this.stub) return;
		try {
			await this.stub.addLog(nodeId, message, logType);
		} catch (e) {
			console.warn("[Reporter] Failed to add log:", e);
		}
	}
}

const CACHE_DIR = join(process.cwd(), ".wrangler", "mock-cache");

// Utility to generate hash
async function hashBuffer(buffer: ArrayBuffer | Buffer): Promise<string> {
	const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
	const hashArray = Array.from(new Uint8Array(hashBuffer));
	return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Check for KV Cache namespace binding
function getCacheKV() {
	return getBinding("CACHE");
}

// Caching helper
async function getCachedResult(key: string): Promise<string | null> {
	const kv = getCacheKV();
	if (kv) {
		return await kv.get(key);
	}

	// Local filesystem fallback
	const filePath = join(CACHE_DIR, `${key.replace(/:/g, "_")}.json`);
	if (existsSync(filePath)) {
		return await Bun.file(filePath).text();
	}
	return null;
}

async function saveCachedResult(key: string, value: string): Promise<void> {
	const kv = getCacheKV();
	const stringValue = typeof value === "string" ? value : JSON.stringify(value);
	if (kv) {
		await kv.put(key, stringValue, { expirationTtl: 7 * 24 * 60 * 60 }); // 7 days
		return;
	}

	// Local filesystem fallback
	const filePath = join(CACHE_DIR, `${key.replace(/:/g, "_")}.json`);
	await Bun.write(filePath, stringValue);
}

/**
 * Runs the VLM model (Llama-3.2-11b-vision-instruct) on Cloudflare Workers AI or via REST API/Mock fallback.
 */
async function runVisionModel(
	imageBuffer: ArrayBuffer | Buffer,
	prompt: string,
): Promise<string> {
	const aiBinding = getBinding("AI");

	// Llama 3.2 Vision requires base64-encoded image + messages array format
	const base64Image = Buffer.from(imageBuffer).toString("base64");

	if (aiBinding) {
		try {
			console.log(
				"[Pipeline] Calling Cloudflare AI binding (Llama 3.2 Vision)...",
			);
			const input = {
				image: base64Image,
				messages: [
					{
						role: "system",
						content:
							"You are a precise product data extraction assistant. Follow all instructions exactly.",
					},
					{ role: "user", content: prompt },
				],
			};
			const result = await aiBinding.run(
				"@cf/meta/llama-3.2-11b-vision-instruct",
				input,
			);
			// Llama 3.2 Vision returns { response: string } or { choices: [...] }
			const text =
				(result as any)?.response ||
				(result as any)?.choices?.[0]?.message?.content ||
				"";
			console.log(
				"[Pipeline] AI response preview:",
				String(text).substring(0, 200),
			);
			return typeof text === "string" ? text : JSON.stringify(text);
		} catch (err) {
			console.error("[Pipeline] Cloudflare AI binding failed:", err);
			throw err;
		}
	}

	const accountId = getBinding("CLOUDFLARE_ACCOUNT_ID");
	const apiToken = getBinding("CLOUDFLARE_API_TOKEN");

	if (accountId && apiToken) {
		try {
			console.log("[Pipeline] Calling Cloudflare AI REST API...");
			const response = await fetch(
				`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/meta/llama-3.2-11b-vision-instruct`,
				{
					method: "POST",
					headers: {
						Authorization: `Bearer ${apiToken}`,
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						image: base64Image,
						messages: [
							{
								role: "system",
								content:
									"You are a precise product data extraction assistant. Follow all instructions exactly.",
							},
							{ role: "user", content: prompt },
						],
					}),
				},
			);

			if (!response.ok) {
				throw new Error(
					`Cloudflare AI API returned ${response.status}: ${await response.text()}`,
				);
			}

			const json = await response.json();
			const res =
				(json as any).result?.response ||
				(json as any).result?.choices?.[0]?.message?.content ||
				"";
			return typeof res === "string" ? res : JSON.stringify(res);
		} catch (err) {
			console.error("[Pipeline] Cloudflare AI REST API failed:", err);
			throw err;
		}
	}

	// Offline mock fallback
	console.log("[Pipeline] Using offline VLM mock responses from fixtures");
	const imageHash = await hashBuffer(imageBuffer);
	const mockAiDir = join(process.cwd(), ".wrangler", "mock-ai");
	const fixturePath = join(mockAiDir, `${imageHash}.json`);
	const fallbackPath = join(mockAiDir, "default.json");

	let fixtureContent = "";
	if (existsSync(fixturePath)) {
		fixtureContent = await Bun.file(fixturePath).text();
	} else if (existsSync(fallbackPath)) {
		fixtureContent = await Bun.file(fallbackPath).text();
	}

	if (fixtureContent) {
		try {
			const parsed = JSON.parse(fixtureContent);
			if (prompt.includes("Read all text")) {
				return parsed.ocr || "";
			} else {
				return typeof parsed.structured === "string"
					? parsed.structured
					: JSON.stringify(parsed.structured || {});
			}
		} catch (err) {
			console.error("[Pipeline] Failed to parse AI mock fixture:", err);
		}
	}

	console.warn("[Pipeline] runVisionModel fell through, returning empty string");
	return "";
}

/**
 * Phase 1: ZXing and OCR (to extract watermark and audit ID)
 */
async function processPhase1(
	orgId: string,
	jobId: string,
	fileName: string,
	imageBuffer: ArrayBuffer,
	reporter: JobReporter,
) {
	const imageHash = await hashBuffer(imageBuffer);

	await reporter.addLog(
		"preprocess",
		`Image ${fileName} hash generated: ${imageHash}`,
		"info",
	);

	// 1. ZXing Barcode Scanning (<100ms)
	const zxingStart = Date.now();
	let barcodeResult: string | null = null;
	try {
		const barcodes = await readBarcodesFromImageFile(
			new Uint8Array(imageBuffer),
			{
				tryHarder: true,
				formats: ["EAN_13", "EAN_8", "UPC_A", "UPC_E", "CODE_128", "CODE_39"],
			},
		);
		if (barcodes && barcodes.length > 0) {
			barcodeResult = barcodes[0].text;
			console.log(
				`[Pipeline] [ZXing] Found barcode ${barcodeResult} in ${fileName}`,
			);
			await reporter.addLog(
				"zxing",
				`[${fileName}] Found barcode: ${barcodeResult}`,
				"success",
			);
		} else {
			await reporter.addLog(
				"zxing",
				`[${fileName}] No barcode found`,
				"warning",
			);
		}
	} catch (err) {
		console.warn(
			`[Pipeline] [ZXing] Barcode scanning failed/skipped for ${fileName}`,
		);
		await reporter.addLog(
			"zxing",
			`[${fileName}] Barcode scan failed`,
			"error",
		);
	}
	const zxingDuration = Date.now() - zxingStart;

	// 2. VLM OCR
	const ocrStart = Date.now();
	const ocrCacheKey = `extraction:${orgId}:${imageHash}:ocr_v2`;
	let ocrOutput = await getCachedResult(ocrCacheKey);
	if (!ocrOutput) {
		const prompt = `Read all text visible on the main product being held or centered in the foreground of this image.
Strictly IGNORE any text on other products visible in the background or on surrounding shelves.
IMPORTANT: There is a digital watermark/overlay text at the bottom or left edge of the image
(typically starting with 'GH...' or 'maverick research'). Extract this watermark text separately
on its own line, prefixed with 'WATERMARK:'. Output all other product label text normally.`;
		await reporter.addLog(
			"ocr",
			`[${fileName}] Calling Workers AI for OCR...`,
			"info",
		);
		ocrOutput = await runVisionModel(imageBuffer, prompt);
		if (ocrOutput) {
			await saveCachedResult(ocrCacheKey, ocrOutput);
			await reporter.addLog(
				"ocr",
				`[${fileName}] OCR text extracted`,
				"success",
			);
		}
	} else {
		await reporter.addLog(
			"ocr",
			`[${fileName}] OCR result loaded from KV Cache`,
			"info",
		);
	}
	const ocrDuration = Date.now() - ocrStart;

	// Parse Watermark from OCR (or fallback)
	let watermarkInfo: any = null;
	let watermarkRawStr = "";

	if (ocrOutput) {
		// First try the WATERMARK: prefix as instructed in the prompt
		const watermarkPrefixMatch = ocrOutput.match(/WATERMARK:\s*([^\n]+)/i);
		if (watermarkPrefixMatch) {
			watermarkRawStr = watermarkPrefixMatch[1].trim();
		} else {
			// Fallback: look for audit ID pattern, ignoring S\d+_ filenames
			const ocrMatch = ocrOutput.match(/(?:^|\s)((?!S\d+_)[A-Z]{1,10}\d{3,}[^\n]+)/i);
			if (ocrMatch) {
				watermarkRawStr = ocrMatch[1].trim();
			}
		}
	}

	if (!watermarkRawStr) {
		const filenameWithoutExt = fileName.replace(/\.[^/.]+$/, "");
		if (/^(?!S\d+_)[A-Z]{0,10}\d{3,}/i.test(filenameWithoutExt)) {
			watermarkRawStr = filenameWithoutExt;
		}
	}

	if (watermarkRawStr) {
		watermarkInfo = parseWatermark(watermarkRawStr);
	}

	return {
		fileName,
		imageHash,
		buffer: imageBuffer,
		zxing: barcodeResult ? { barcode: barcodeResult } : null,
		ocr: ocrOutput,
		watermarkInfo,
		durations: {
			zxing: zxingDuration,
			ocr: ocrDuration,
		},
	};
}

/**
 * Phase 2: Structured Data Extraction (Runs only on representative image)
 */
async function processPhase2(
	orgId: string,
	jobId: string,
	fileName: string,
	imageHash: string,
	imageBuffer: ArrayBuffer,
	ocrOutput: string,
	watermarkInfo: any,
	reporter: JobReporter,
	missingFields?: string[]
) {
	const structuredStart = Date.now();
	// Add suffix to cache key if missingFields is used
	const cacheSuffix = missingFields && missingFields.length > 0 ? `_fallback_${missingFields.join("-")}` : "";
	const structuredCacheKey = `extraction:${orgId}:${imageHash}:structured_v2${cacheSuffix}`;
	let structuredOutput = await getCachedResult(structuredCacheKey);
	
	if (!structuredOutput) {
		let prompt = "";
		if (!missingFields || missingFields.length === 0) {
			prompt = `You are a structured data extractor. Analyze the product label and return a JSON object with the following fields:
- ITEM_NAME: Exact product name (do NOT include the Brand or Manufacturer, and do NOT copy the Watermark here)
- BARCODE: Barcode number (digits only)
- MANUFACTURER: Manufacturer name
- BRAND: Brand name
- WEIGHT: Weight or volume (e.g. 500g, 330ml, 1.5L)
- PACKAGING_TYPE: Packaging format (Bottle, Can, Box, Pack, Jar, Pouch, etc.)
- COUNTRY: Country of origin
- VARIANT: Scent, flavor, or variant name (e.g. Lemon, Original, Scented)
- TYPE: Category (e.g. Soft Drink, Shampoo, Detergent)
- FRAGRANCE_FLAVOR: Flavor or fragrance description
- PROMOTION: Slogans or text about offers/sales (e.g. "2 for R25", "Buy 1 Get 1 Free")
- ADDONS: Free items or additives (e.g. "with free spoon")
- TAGLINE: Slogan or marketing phrase
- WATERMARK_RAW: Extract the digital watermark/overlay text exactly as it appears at the bottom or left edge.
- PRODUCT_GROUP_KEY: Using the WATERMARK_RAW text, extract the product description portion.

CRITICAL: Focus ONLY on the single main product being held or centered. Ignore all products visible on shelves in the background.

Return ONLY valid JSON. Do not include markdown wraps or code block formatting. Format:
{
  "ITEM_NAME": "...",
  "BARCODE": "...",
  ...
}`;
		} else {
			prompt = `You are a structured data extractor. Analyze the product label and return ONLY the following missing fields in a JSON object:
${missingFields.map((f) => `- ${f}`).join("\n")}

CRITICAL: Focus ONLY on the single main product being held or centered. Ignore all products visible on shelves in the background.

Return ONLY valid JSON. Do not include markdown wraps or code block formatting. Format:
{
  "${missingFields[0]}": "..."
}`;
		}
		await reporter.addLog(
			"structured",
			`[${fileName}] Calling Llama-3.2-11b-Vision for structured JSON...`,
			"info",
		);
		structuredOutput = await runVisionModel(imageBuffer, prompt);
		if (structuredOutput) {
			await saveCachedResult(structuredCacheKey, structuredOutput);
			await reporter.addLog(
				"structured",
				`[${fileName}] Structured data extracted`,
				"success",
			);
		}
	} else {
		await reporter.addLog(
			"structured",
			`[${fileName}] Structured data loaded from KV Cache`,
			"info",
		);
	}

	let visionData: Partial<Record<any, string>> = {};
	let productGroupKey = "";

	try {
		let jsonStr = structuredOutput;
		const jsonMatch = structuredOutput.match(/```(?:json)?\s*([\s\S]*?)```/);
		if (jsonMatch) {
			jsonStr = jsonMatch[1];
		} else {
			const start = structuredOutput.indexOf("{");
			const end = structuredOutput.lastIndexOf("}");
			if (start !== -1 && end !== -1 && end > start) {
				jsonStr = structuredOutput.substring(start, end + 1);
			}
		}

		const parsed = JSON.parse(jsonStr.trim());
		productGroupKey = parsed.PRODUCT_GROUP_KEY || "";

		for (const col of IMDB_COLUMNS) {
			if (parsed[col] !== undefined) {
				visionData[col] = String(parsed[col]);
			}
		}
		
		if (!productGroupKey && parsed.WATERMARK_RAW) {
			const wm = parseWatermark(parsed.WATERMARK_RAW);
			if (wm) productGroupKey = wm.productDescription;
		}

	} catch (err) {
		console.error(`[Pipeline] Failed to parse structured JSON for ${fileName}:`, err);
	}

	// Fallback group key
	if (!productGroupKey && watermarkInfo) {
		productGroupKey = watermarkInfo.productDescription;
	}
	if (!productGroupKey) {
		const brand = visionData.BRAND || "";
		const item = visionData.ITEM_NAME || "";
		productGroupKey = brand || item ? `${brand} ${item}`.trim() : fileName.split(".")[0];
	}

	const structuredDuration = Date.now() - structuredStart;

	return {
		vision: visionData,
		productGroupKey,
		durations: { structured: structuredDuration }
	};
}
/**
 * Main job processing engine.
 */
export async function processJob(
	jobId: string,
	orgId: string,
	imageKeys: string[],
	env: any = null,
): Promise<void> {
	const reporter = new JobReporter(env, jobId);

	console.log(`[Pipeline] Starting Job ${jobId} for Organisation ${orgId}`);

	await reporter.updateNodeState("upload", "active");
	await reporter.addLog(
		"upload",
		`Received Job ${jobId} with ${imageKeys.length} images`,
		"info",
	);

	try {
		// 1. Update job to PROCESSING
		await db
			.update(jobs)
			.set({
				status: "PROCESSING",
				progress: 10,
				startedAt: new Date().toISOString(),
			})
			.where(eq(jobs.id, jobId));

		// 2. Load and process images
		await reporter.addLog(
			"upload",
			`Fetching ${imageKeys.length} images from storage`,
			"info",
		);

		const extractions: (RawExtractionPerImage & {
			productGroupKey: string;
			watermarkInfo?: any;
		})[] = [];

		let totalUploadMs = 0;
		let totalZxing = 0;
		let totalOcr = 0;
		let totalStructured = 0;

		// Phase 1: Run ZXing and OCR on all images to gather metadata
		const phase1Results: any[] = [];

		for (let i = 0; i < imageKeys.length; i++) {
			const key = imageKeys[i];
			const fileName = key.split("/").pop() || `image_${i}`;

			const uploadStart = Date.now();
			const buffer = await getUpload(orgId, jobId, fileName);
			totalUploadMs += Date.now() - uploadStart;

			if (!buffer) {
				console.warn(`[Pipeline] Could not load image file: ${fileName}`);
				await reporter.addLog("upload", `Could not load image: ${fileName}`, "error");
				continue;
			}
			await reporter.addLog("upload", `Loaded ${fileName} successfully`, "success");

			console.log(`[Pipeline] Phase 1 - Processing image ${i + 1}/${imageKeys.length}: ${fileName}`);

			if (i === 0) {
				const uploadBadge = totalUploadMs < 1000 ? `${totalUploadMs}ms` : `${(totalUploadMs / 1000).toFixed(1)}s`;
				await reporter.updateNodeState("upload", "completed", undefined, undefined, uploadBadge);
				await reporter.updateEdgeState("e1", true, "#10b981");
				await reporter.updateEdgeState("e2", true, "#10b981");
				await reporter.updateEdgeState("e3", true, "#10b981");
				await reporter.updateNodeState("zxing", "active");
				await reporter.updateNodeState("ocr", "active");
				await reporter.updateNodeState("structured", "active");
			}

			const extPhase1 = await processPhase1(orgId, jobId, fileName, buffer, reporter);
			phase1Results.push(extPhase1);

			if (extPhase1.durations) {
				totalZxing += extPhase1.durations.zxing || 0;
				totalOcr += extPhase1.durations.ocr || 0;
			}
			
			const progressPercent = Math.min(40, 10 + Math.round(((i + 1) / imageKeys.length) * 30));
			await db.update(jobs).set({ progress: progressPercent }).where(eq(jobs.id, jobId));
		}

		// Pre-Group Phase 1 results
		const preGroups: Record<string, any[]> = {};
		for (const p1 of phase1Results) {
			const auditId = p1.watermarkInfo?.auditId;
			const fnMatch = p1.fileName.match(/^S(\d+)_(\d+)/i);
			let groupKey = p1.fileName; // default fallback

			if (auditId) {
				groupKey = `audit_${auditId}`;
			} else if (fnMatch) {
				// Group by store + nearby image ID block (divide by 5 so nearby IDs group together)
				const storeId = fnMatch[1];
				const block = Math.floor(parseInt(fnMatch[2], 10) / 5);
				groupKey = `seq_${storeId}_${block}`;
			}

			if (!preGroups[groupKey]) preGroups[groupKey] = [];
			preGroups[groupKey].push(p1);
		}

		// Phase 2: Structured Data Extraction (1 per pre-group)
		let phase2Count = 0;
		const totalGroups = Object.keys(preGroups).length;

		for (const [groupKey, group] of Object.entries(preGroups)) {
			// Select Representative Image
			// 1. Has Barcode
			// 2. Side is 'Back' or 'Barcode'
			// 3. Fallback to first
			let rep = group[0];
			for (const img of group) {
				if (img.zxing?.barcode) {
					rep = img;
					break;
				}
				const side = (img.watermarkInfo?.side || "").toLowerCase();
				if (side === "back" || side === "barcode" || side === "second_side") {
					rep = img;
				}
			}

			console.log(`[Pipeline] Phase 2 - Running structured extraction for pre-group ${groupKey} on ${rep.fileName}`);
			const extPhase2 = await processPhase2(
				orgId, jobId, rep.fileName, rep.imageHash, rep.buffer, rep.ocr, rep.watermarkInfo, reporter
			);
			
			if (extPhase2.durations) {
				totalStructured += extPhase2.durations.structured || 0;
			}

			// Fallback Loop for Missing Critical Fields
			const criticalFields = ["MANUFACTURER", "BRAND", "WEIGHT", "COUNTRY", "PACKAGING_TYPE", "ITEM_NAME"];
			let currentVision = { ...extPhase2.vision };
			let missingFields = criticalFields.filter(f => !currentVision[f] || String(currentVision[f]).trim() === "");

			if (missingFields.length > 0 && group.length > 1) {
				// Query up to 2 other images in the group to find the missing fields
				const fallbackImages = group.filter(img => img.fileName !== rep.fileName).slice(0, 2);
				for (const fallbackImg of fallbackImages) {
					await reporter.addLog("structured", `[${fallbackImg.fileName}] Missing fields [${missingFields.join(", ")}]. Querying fallback image...`, "info");
					
					const fallbackExt = await processPhase2(
						orgId, jobId, fallbackImg.fileName, fallbackImg.imageHash, fallbackImg.buffer, fallbackImg.ocr, fallbackImg.watermarkInfo, reporter, missingFields
					);
					
					if (fallbackExt.durations) {
						totalStructured += fallbackExt.durations.structured || 0;
					}

					// Merge found fields
					for (const f of missingFields) {
						if (fallbackExt.vision[f] && String(fallbackExt.vision[f]).trim() !== "") {
							currentVision[f] = fallbackExt.vision[f];
						}
					}

					missingFields = criticalFields.filter(f => !currentVision[f] || String(currentVision[f]).trim() === "");
					if (missingFields.length === 0) break; // Break early if all found
				}
			}

			// Distribute results to all images in pre-group
			for (const img of group) {
				// We assemble the final raw extraction
				const finalExt: any = {
					fileName: img.fileName,
					zxing: img.zxing || rep.zxing, // Share barcode if missing
					ocr: img.ocr,
					vision: currentVision,      // Shared Structured Data (including fallbacks)
					productGroupKey: extPhase2.productGroupKey,
					watermarkInfo: img.watermarkInfo || rep.watermarkInfo
				};
				extractions.push(finalExt);
			}

			phase2Count++;
			const progressPercent = Math.min(80, 40 + Math.round((phase2Count / totalGroups) * 40));
			await db.update(jobs).set({ progress: progressPercent }).where(eq(jobs.id, jobId));
		}

		// Extraction phase complete
		const zxingBadge = totalZxing < 1000 ? `${totalZxing}ms` : `${(totalZxing / 1000).toFixed(1)}s`;
		const ocrBadge = totalOcr < 1000 ? `${totalOcr}ms` : `${(totalOcr / 1000).toFixed(1)}s`;
		const structuredBadge = totalStructured < 1000 ? `${totalStructured}ms` : `${(totalStructured / 1000).toFixed(1)}s`;

		await reporter.updateNodeState("zxing", "completed", undefined, undefined, zxingBadge);
		await reporter.updateNodeState("ocr", "completed", undefined, undefined, ocrBadge);
		await reporter.updateNodeState("structured", "completed", undefined, undefined, structuredBadge);

		await reporter.updateEdgeState("e4", true, "#10b981");
		await reporter.updateEdgeState("e5", true, "#10b981");
		await reporter.updateEdgeState("e6", true, "#10b981");

		// 3. Fast Pre-Grouping
		const groupingStart = Date.now();
		await reporter.updateNodeState("grouping", "active");
		await reporter.addLog(
			"grouping",
			"Performing fast metadata pre-grouping based on barcodes and watermark IDs...",
			"info",
		);

		const groups = groupExtractions(extractions);

		await reporter.addLog(
			"grouping",
			`Pre-grouping complete: Identified ${Object.keys(groups).length} distinct product groups.`,
			"success",
		);

		const groupingDuration = Date.now() - groupingStart;
		const groupingBadge = groupingDuration < 1000 ? `${groupingDuration}ms` : `${(groupingDuration / 1000).toFixed(1)}s`;
		await reporter.updateNodeState("grouping", "completed", undefined, undefined, groupingBadge);
		await reporter.updateEdgeState("e7", true, "#10b981");

		// 4. Semantic Post-AI Matcher (Greedy Bipartite Matcher)
		const postAiStart = Date.now();
		await reporter.updateNodeState("post_ai_merging", "active");
		await reporter.addLog(
			"post_ai_merging",
			"Resolving remaining mixed fronts and backs using Greedy Bipartite Matcher...",
			"info",
		);
		await reporter.addLog(
			"post_ai_merging",
			`Semantic resolution completed. Final buckets count: ${Object.keys(groups).length}.`,
			"success",
		);
		const postAiDuration = Date.now() - postAiStart;
		const postAiBadge = postAiDuration < 1000 ? `${Math.max(1, postAiDuration)}ms` : `${(postAiDuration / 1000).toFixed(1)}s`;
		await reporter.updateNodeState("post_ai_merging", "completed", undefined, undefined, postAiBadge);
		await reporter.updateEdgeState("e7_post", true, "#10b981");

		await reporter.updateNodeState("aggregation", "active");
		await reporter.updateNodeState("normalization", "active");
		await reporter.updateNodeState("database", "active");

		let totalAggregationMs = 0;
		let totalNormalizationMs = 0;
		let totalDatabaseMs = 0;

		// 4. Multi-Image Aggregation per group
		for (const [groupKey, groupExts] of Object.entries(groups)) {
			const aggStart = Date.now();
			const aggregatedRecord = {} as ImdbRecord;
			const fieldMetadata: Record<ImdbColumnName, FieldMeta> = {} as any;

			// We will also compile rawEvidence for audit trail
			const rawEvidence: RawExtraction = {
				images: groupExts.map((e) => ({
					fileName: e.fileName,
					zxing: e.zxing,
					ocr: e.ocr,
					vision: e.vision,
				})),
			};

			// Loop through all 13 columns to merge
			for (const col of IMDB_COLUMNS) {
				// Collect candidate values with source & confidence
				const candidates: {
					value: string;
					source: ExtractionSource;
					confidence: number;
				}[] = [];

				for (const ext of groupExts) {
					// Scale candidate confidence by similarity to group representative
					let matchFactor = 1.0;
					if (ext !== groupExts[0]) {
						matchFactor = computeGroupSimilarity(groupExts[0], ext);
					}

					// Barcode can come from ZXing
					if (col === "BARCODE" && ext.zxing?.barcode) {
						candidates.push({
							value: ext.zxing.barcode,
							source: "ZXing",
							confidence: 1.0 * matchFactor,
						});
					}

					// Watermark parsed values (0.9 confidence)
					if (ext.watermarkInfo) {
						let val: string | null = null;
						if (col === "ITEM_NAME" && ext.watermarkInfo.productDescription)
							val = ext.watermarkInfo.productDescription;
						if (col === "WEIGHT" && ext.watermarkInfo.weight)
							val = ext.watermarkInfo.weight;
						if (col === "PACKAGING_TYPE" && ext.watermarkInfo.packaging)
							val = ext.watermarkInfo.packaging;
						if (col === "MANUFACTURER" && ext.watermarkInfo.manufacturer)
							val = ext.watermarkInfo.manufacturer;
						if (col === "COUNTRY" && ext.watermarkInfo.country)
							val = ext.watermarkInfo.country;

						if (val) {
							candidates.push({
								value: val,
								source: "Watermark",
								confidence: 0.9 * matchFactor,
							});
						}
					}

					// Structured VLM values
					if (ext.vision?.[col]) {
						candidates.push({
							value: ext.vision[col]!,
							source: "Vision",
							confidence: 0.8 * matchFactor,
						});
					}

					// OCR parsing (regex fallback)
					if (ext.ocr) {
						// Simple regex match for "COLUMN: Value" format in VLM OCR text
						const regex = new RegExp(`${col}:\\s*([^\\n]+)`, "i");
						const match = ext.ocr.match(regex);
						if (match && match[1]) {
							candidates.push({
								value: match[1].trim(),
								source: "OCR",
								confidence: 0.6 * matchFactor,
							});
						}
					}
				}

				// Aggregate candidates
				if (candidates.length === 0) {
					aggregatedRecord[col] = "";
					fieldMetadata[col] = { value: "", source: "Merged", confidence: 0.0 };
					continue;
				}

				// Group identical values to boost confidence
				const valueGroups: Record<string, typeof candidates> = {};
				for (const cand of candidates) {
					const normVal = normalizeField(col, cand.value);
					if (!valueGroups[normVal]) {
						valueGroups[normVal] = [];
					}
					valueGroups[normVal].push(cand);
				}

				// Find the best value group
				let bestNormValue = "";
				let bestConfidence = 0.0;
				let bestSource: ExtractionSource = "Merged";

				for (const [normVal, group] of Object.entries(valueGroups)) {
					// Base confidence is the max base confidence in the group
					const maxBaseConf = Math.max(...group.map((c) => c.confidence));
					// Boost confidence by 0.1 for every additional matching value from other sources/images
					const matches = group.length;
					const finalConf = Math.min(1.0, maxBaseConf + 0.1 * (matches - 1));

					if (finalConf > bestConfidence) {
						bestConfidence = finalConf;
						bestNormValue = normVal;
						bestSource = group.length > 1 ? "Merged" : group[0].source;
					}
				}

				// Apply Empty Value Policy: empty string if confidence below threshold (never hallucinate)
				if (bestConfidence < FIELD_EMPTY_THRESHOLD) {
					aggregatedRecord[col] = "";
					fieldMetadata[col] = {
						value: "",
						source: bestSource,
						confidence: bestConfidence,
					};
				} else {
					aggregatedRecord[col] = bestNormValue;
					fieldMetadata[col] = {
						value: bestNormValue,
						source: bestSource,
						confidence: bestConfidence,
					};
				}
			}

			await reporter.addLog(
				"aggregation",
				`Aggregated fields for product: ${groupKey}`,
				"success",
			);

			totalAggregationMs += Date.now() - aggStart;

			// 5. Final Normalization Layer
			const normStart = Date.now();
			const finalRecord = normalizeRecord(aggregatedRecord);
			await reporter.addLog(
				"normalization",
				`Normalized record for ${finalRecord.ITEM_NAME || groupKey}`,
				"success",
			);

			// Check if all fields are empty. If so, skip database insertion.
			const allFieldsEmpty = IMDB_COLUMNS.every((col) => !finalRecord[col]);
			if (allFieldsEmpty) {
				await reporter.addLog(
					"database",
					`Skipped saving record for group ${groupKey} because all fields are empty`,
					"info",
				);
				continue;
			}

			// 6. Compute Overall Weighted Confidence
			let weightedSum = 0;
			let weightTotal = 0;
			for (const col of IMDB_COLUMNS) {
				const weight = FIELD_WEIGHTS[col];
				const conf = fieldMetadata[col].confidence;
				weightedSum += conf * weight;
				weightTotal += weight;
			}
			const overallConfidence = weightTotal > 0 ? weightedSum / weightTotal : 0;
			const flagged = overallConfidence < CONFIDENCE_THRESHOLD;

			totalNormalizationMs += Date.now() - normStart;

			// Get canonical product group tag name (pick the most common or first raw group key)
			const groupTag = groupExts[0].productGroupKey;

			// 7. Write IMDB Record to DB
			const dbStart = Date.now();
			const recordId = crypto.randomUUID();
			await db.insert(imdbRecords).values({
				id: recordId,
				jobId,
				organisationId: orgId,
				ITEM_NAME: finalRecord.ITEM_NAME,
				BARCODE: finalRecord.BARCODE,
				MANUFACTURER: finalRecord.MANUFACTURER,
				BRAND: finalRecord.BRAND,
				WEIGHT: finalRecord.WEIGHT,
				PACKAGING_TYPE: finalRecord.PACKAGING_TYPE,
				COUNTRY: finalRecord.COUNTRY,
				VARIANT: finalRecord.VARIANT,
				TYPE: finalRecord.TYPE,
				FRAGRANCE_FLAVOR: finalRecord.FRAGRANCE_FLAVOR,
				PROMOTION: finalRecord.PROMOTION,
				ADDONS: finalRecord.ADDONS,
				TAGLINE: finalRecord.TAGLINE,
				confidence: overallConfidence,
				flagged,
				rawExtraction: rawEvidence,
				fieldMetadata,
				productGroupKey: groupTag,
			});
			await reporter.addLog(
				"database",
				`Generated & saved final record: ${finalRecord.ITEM_NAME || groupTag}`,
				"success",
			);
			totalDatabaseMs += Date.now() - dbStart;
		}

		const aggBadge = totalAggregationMs < 1000 ? `${totalAggregationMs}ms` : `${(totalAggregationMs / 1000).toFixed(1)}s`;
		const normBadge = totalNormalizationMs < 1000 ? `${totalNormalizationMs}ms` : `${(totalNormalizationMs / 1000).toFixed(1)}s`;
		const dbBadge = totalDatabaseMs < 1000 ? `${totalDatabaseMs}ms` : `${(totalDatabaseMs / 1000).toFixed(1)}s`;

		await reporter.updateNodeState("aggregation", "completed", undefined, undefined, aggBadge);
		await reporter.updateEdgeState("e8", true, "#10b981");
		await reporter.updateNodeState("normalization", "completed", undefined, undefined, normBadge);
		await reporter.updateEdgeState("e9", true, "#10b981");
		await reporter.updateNodeState("database", "completed", undefined, undefined, dbBadge);
		await reporter.updateEdgeState("e10", true, "#10b981");

		const dedupeStart = Date.now();
		await reporter.updateNodeState("deduplication", "active");

		// 8. Post-Job Duplicate Detection
		// Collect IDs of records just written by this job
		const newRecords = await db
			.select()
			.from(imdbRecords)
			.where(
				and(
					eq(imdbRecords.jobId, jobId),
					eq(imdbRecords.organisationId, orgId),
				),
			);

		// Query all existing ACTIVE records for this org, excluding records from the current job
		const existingRecords = await db
			.select()
			.from(imdbRecords)
			.where(
				and(
					eq(imdbRecords.organisationId, orgId),
					eq(imdbRecords.status, "ACTIVE"),
					ne(imdbRecords.jobId, jobId),
				),
			);

		const dupInserts: (typeof duplicatePairs.$inferInsert)[] = [];

		for (const newRec of newRecords) {
			for (const existing of existingRecords) {
				// BARCODE_MATCH: both have non-empty barcodes and they match exactly
				const newBarcode = normalizeField("BARCODE", newRec.BARCODE);
				const existingBarcode = normalizeField("BARCODE", existing.BARCODE);

				if (newBarcode && existingBarcode && newBarcode === existingBarcode) {
					dupInserts.push({
						id: crypto.randomUUID(),
						orgId,
						recordAId: newRec.id,
						recordBId: existing.id,
						similarityScore: 1.0,
						reason: "BARCODE_MATCH",
						status: "PENDING",
					});
					continue; // barcode match is strongest — skip weaker checks for this pair
				}

				// BRAND_WEIGHT_MATCH: same normalized BRAND and same normalized WEIGHT
				const newBrand = normalizeField("BRAND", newRec.BRAND);
				const existingBrand = normalizeField("BRAND", existing.BRAND);
				const newWeight = normalizeField("WEIGHT", newRec.WEIGHT);
				const existingWeight = normalizeField("WEIGHT", existing.WEIGHT);

				if (
					newBrand &&
					existingBrand &&
					newBrand.toLowerCase() === existingBrand.toLowerCase() &&
					newWeight &&
					existingWeight &&
					newWeight === existingWeight
				) {
					dupInserts.push({
						id: crypto.randomUUID(),
						orgId,
						recordAId: newRec.id,
						recordBId: existing.id,
						similarityScore: 0.85,
						reason: "BRAND_WEIGHT_MATCH",
						status: "PENDING",
					});
				}
			}
		}

		// Batch-insert duplicate pairs
		if (dupInserts.length > 0) {
			console.log(
				`[Pipeline] Found ${dupInserts.length} potential duplicate pair(s) for job ${jobId}`,
			);
			for (const dup of dupInserts) {
				await db.insert(duplicatePairs).values(dup);
			}
		}

		// 9. Mark Job as COMPLETED
		await db
			.update(jobs)
			.set({
				status: "COMPLETED",
				progress: 100,
				completedAt: new Date().toISOString(),
			})
			.where(eq(jobs.id, jobId));

		await reporter.addLog(
			"deduplication",
			`Committed ${newRecords.length} records and ${dupInserts.length} duplicate pairs`,
			"success",
		);
		const dedupeDuration = Date.now() - dedupeStart;
		const dedupeBadge = dedupeDuration < 1000 ? `${dedupeDuration}ms` : `${(dedupeDuration / 1000).toFixed(1)}s`;
		await reporter.updateNodeState("deduplication", "completed", undefined, undefined, dedupeBadge);

		console.log(`[Pipeline] Job ${jobId} finished successfully!`);
	} catch (err: any) {
		console.error(`[Pipeline] Job ${jobId} failed:`, err);

		// Mark Job as FAILED
		await db
			.update(jobs)
			.set({
				status: "FAILED",
				progress: 100,
				error: err?.message || String(err),
				completedAt: new Date().toISOString(),
			})
			.where(eq(jobs.id, jobId));

		await reporter.addLog("upload", `Job Failed: ${err?.message}`, "error");
		await reporter.updateNodeState("upload", "failed");
	}
}
