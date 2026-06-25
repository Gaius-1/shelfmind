import { db } from "../db/index.ts";
import { jobs, imdbRecords, duplicatePairs } from "../db/schema.ts";
import { eq, and, ne, inArray } from "drizzle-orm";
import pLimit from "p-limit";
import type { IMDBProduct } from "../types/imdb.ts";
import { FIELD_WEIGHTS, FIELD_EMPTY_THRESHOLD } from "../types/imdb.ts";
import { getUpload } from "./storage.ts";
import { groupAndMergeImages, isSafeSubstringMatch } from "./grouping.ts";
import { normalizeBarcode, normalizeWeight, normalizePackaging, normalizeCountry, normalizeField, normalizeManufacturer, normalizeBrand, isValidEAN13 } from "./normalization.ts";
import { parseWatermark } from "./watermark-parser.ts";
import { hashImage, getCachedExtraction, putCachedExtraction, invalidateStats } from "./kv-cache.ts";

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

	async updateNodeState(nodeId: string, status: string, processedCount?: number, totalCount?: number, badge?: string, title?: string, description?: string) {
		if (!this.stub) return;
		try {
			await this.stub.updateNodeState(nodeId, status as any, processedCount, totalCount, badge, title, description);
		} catch (e) { console.warn("[JobReporter] updateNodeState failed:", e); }
	}

	async updateEdgeState(edgeId: string, animated: boolean, color: string) {
		if (!this.stub) return;
		try {
			await this.stub.updateEdgeState(edgeId, animated, color);
		} catch (e) { console.warn("[JobReporter] updateEdgeState failed:", e); }
	}

	async addLog(nodeId: string, message: string, logType: "info" | "success" | "warning" | "error") {
		if (!this.stub) return;
		try {
			await this.stub.addLog(nodeId, message, logType);
		} catch (e) { console.warn("[JobReporter] addLog failed:", e); }
	}
}

export function getOcrProvider(env: any = null): {
    provider: "rolmocr" | "google" | "none";
    apiKey?: string;
    endpoint?: string;
    model?: string;
} {
    // 1. Check for Fireworks API key specifically meant for RolmOCR
    const fireworksKey = env?.FIREWORKS_API_KEY || (typeof process !== "undefined" ? process.env.FIREWORKS_API_KEY : undefined);
    const hasExplicitRolmOcr = env?.ROLMOCR_MODEL || env?.REDUCTO_MODEL || (typeof process !== "undefined" ? (process.env.ROLMOCR_MODEL || process.env.REDUCTO_MODEL) : undefined);
    if (fireworksKey && hasExplicitRolmOcr) {
        return {
            provider: "rolmocr",
            apiKey: fireworksKey,
            endpoint: env?.ROLMOCR_API_ENDPOINT || env?.REDUCTO_API_ENDPOINT || (typeof process !== "undefined" ? (process.env.ROLMOCR_API_ENDPOINT || process.env.REDUCTO_API_ENDPOINT) : undefined) || "https://api.fireworks.ai/inference/v1/chat/completions",
            model: hasExplicitRolmOcr
        };
    }

    // 2. Check for general RolmOCR / Reducto env vars
    const rolmocrKey = env?.ROLMOCR_API_KEY || env?.REDUCTO_API_KEY || (typeof process !== "undefined" ? (process.env.ROLMOCR_API_KEY || process.env.REDUCTO_API_KEY) : undefined);
    const rolmocrEndpoint = env?.ROLMOCR_API_ENDPOINT || env?.REDUCTO_API_ENDPOINT || (typeof process !== "undefined" ? (process.env.ROLMOCR_API_ENDPOINT || process.env.REDUCTO_API_ENDPOINT) : undefined);
    const rolmocrModel = env?.ROLMOCR_MODEL || env?.REDUCTO_MODEL || (typeof process !== "undefined" ? (process.env.ROLMOCR_MODEL || process.env.REDUCTO_MODEL) : undefined);

    if (rolmocrKey || rolmocrEndpoint) {
        return {
            provider: "rolmocr",
            apiKey: rolmocrKey,
            endpoint: rolmocrEndpoint || "http://localhost:8000/v1/chat/completions",
            model: rolmocrModel || "reducto/RolmOCR-7b"
        };
    }

    // 3. Fallback to Google Vision
    const googleKey = env?.GOOGLE_VISION_API_KEY || (typeof process !== "undefined" ? process.env.GOOGLE_VISION_API_KEY : undefined);
    if (googleKey) {
        return {
            provider: "google",
            apiKey: googleKey
        };
    }

    return { provider: "none" };
}

async function extractWithRolmOCR(base64Image: string, env: any = null, reporter: any = null, fileName: string = ""): Promise<string> {
    const config = getOcrProvider(env);
    if (config.provider !== "rolmocr" || !config.endpoint) {
        if (reporter) await reporter.addLog("ocr", `[${fileName}] RolmOCR not properly configured. Skipping.`, "warning");
        return "";
    }

    try {
        const response = await fetch(config.endpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...(config.apiKey ? { "Authorization": `Bearer ${config.apiKey}` } : {})
            },
            body: JSON.stringify({
                model: config.model,
                messages: [
                    {
                        role: "user",
                        content: [
                            { type: "text", text: "Extract all text from this document." },
                            { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64Image}` } }
                        ]
                    }
                ]
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("[RolmOCR] API error:", errorText);
            if (reporter) await reporter.addLog("ocr", `[${fileName}] RolmOCR API error: ${errorText.substring(0, 100)}. Falling back to Qwen-only.`, "error");
            return "";
        }

        const data = (await response.json()) as any;
        return data.choices?.[0]?.message?.content || "";
    } catch (e: any) {
        console.error("[RolmOCR] Request failed:", e);
        if (reporter) await reporter.addLog("ocr", `[${fileName}] RolmOCR request failed. Falling back to Qwen-only.`, "error");
        return "";
    }
}

async function extractWithGoogleVision(base64Image: string, env: any = null, reporter: any = null, fileName: string = ""): Promise<string> {
    const apiKey = env?.GOOGLE_VISION_API_KEY || (typeof process !== "undefined" ? process.env.GOOGLE_VISION_API_KEY : undefined);
    
    if (!apiKey) {
        if (reporter) await reporter.addLog("ocr", "Missing GOOGLE_VISION_API_KEY. Skipping OCR pass.", "warning");
        return "";
    }

    try {
        const response = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                requests: [{
                    image: { content: base64Image },
                    features: [{ type: "DOCUMENT_TEXT_DETECTION" }]
                }]
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("[Google Vision] API error:", errorText);
            if (reporter) await reporter.addLog("ocr", `[${fileName}] Google Vision API error (e.g. out of credits). Falling back to Qwen-only.`, "error");
            return "";
        }

        const data = (await response.json()) as any;
        return data.responses?.[0]?.fullTextAnnotation?.text || "";
    } catch (e: any) {
        console.error("[Google Vision] Failed to fetch:", e);
        if (reporter) await reporter.addLog("ocr", `[${fileName}] Google Vision request failed. Falling back to Qwen-only.`, "error");
        return "";
    }
}

async function cropImageMargin(
	buffer: ArrayBuffer,
	margin: "bottom" | "top" | "left" | "right",
	env: any = null,
): Promise<ArrayBuffer> {
	if (!env || !env.IMAGES) {
		return buffer;
	}
	try {
		// Crop the edge strip directly at high resolution (3200x960 / 960x3200).
		// By cropping directly to high dimensions, we preserve the maximum native camera
		// sensor pixels for the watermark text, rather than downscaling first and upscaling later.
		const cropOptions: any = { fit: "crop", format: "jpeg", quality: 95 };
		if (margin === "bottom") {
			cropOptions.gravity = { x: 0.5, y: 1.0 }; // anchor to very bottom edge
			cropOptions.width = 3200;
			cropOptions.height = 240;
		} else if (margin === "top") {
			cropOptions.gravity = { x: 0.5, y: 0.0 }; // anchor to very top edge
			cropOptions.width = 3200;
			cropOptions.height = 240;
		} else if (margin === "left") {
			cropOptions.gravity = { x: 0.0, y: 0.5 }; // anchor to very left edge
			cropOptions.width = 240;
			cropOptions.height = 3200;
		} else if (margin === "right") {
			cropOptions.gravity = { x: 1.0, y: 0.5 }; // anchor to very right edge
			cropOptions.width = 240;
			cropOptions.height = 3200;
		}
		const croppedTransform = env.IMAGES.transform(new Response(buffer), cropOptions);
		const croppedBuffer = await croppedTransform.arrayBuffer();
		if (!croppedBuffer || croppedBuffer.byteLength === 0) return buffer;
		return croppedBuffer;
	} catch (e) {
		console.error(`[Pipeline] Image crop for margin ${margin} failed:`, e);
		return buffer;
	}
}

/**
 * Removes the shelf/store background from a product photo using Cloudflare Images
 * AI segmentation (BiRefNet). Returns a clean white-background JPEG buffer.
 * Falls back to the original buffer if the binding is unavailable or fails.
 * MUST be called AFTER watermark margin crops — edges are treated as background.
 */
async function removeBackground(
	buffer: ArrayBuffer,
	env: any = null,
): Promise<ArrayBuffer> {
	if (!env || !env.IMAGES) return buffer;
	try {
		const transformed = env.IMAGES.transform(new Response(buffer), {
			segment: "foreground",
			background: "white", // solid white — better contrast for OCR than transparent
			format: "jpeg",
			quality: 95,
		});
		const result = await transformed.arrayBuffer();
		if (!result || result.byteLength === 0) {
			console.warn("[Pipeline] Background removal returned empty buffer, using original.");
			return buffer;
		}
		return result;
	} catch (e) {
		console.error("[Pipeline] Background removal failed, using original:", e);
		return buffer;
	}
}

async function extractWithQwen(imageBuffer: ArrayBuffer, fileName: string, ocrText: string, env: any = null, watermarkData: any = null): Promise<IMDBProduct | null> {
    const base64Image = Buffer.from(imageBuffer).toString("base64");
    
    // Read from Cloudflare env bindings if available, otherwise fallback to process.env
    const apiKey = env?.QWEN_API_KEY || (typeof process !== "undefined" ? process.env.QWEN_API_KEY : undefined);
    const endpoint = env?.QWEN_API_ENDPOINT || (typeof process !== "undefined" ? process.env.QWEN_API_ENDPOINT : undefined) || "https://ws-e8idycj2w4qgstsm.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1/chat/completions";

    if (!apiKey) {
        throw new Error("Missing QWEN_API_KEY in environment");
    }

    let prompt = "";
    if (watermarkData) {
        prompt = `You are a precise product data extraction assistant. Extract product details as a JSON object with EXACTLY these fields:
BARCODE, BRAND, VARIANT, TYPE, FRAGRANCE_FLAVOR, PROMOTION, ADDONS, TAGLINE.
ALSO, output a nested object named "fieldConfidence" containing a float (0.0 to 1.0) representing your mathematical certainty for each extracted field.
Note 1: If text is blurry or not explicitly printed, output an empty string "". DO NOT guess.
Note 2 (CRITICAL): Use the exact raw OCR text below for spelling.

--- FEW-SHOT EXAMPLES ---
Example 1:
OCR Text: "BLUE BAND 250G PLASTIC TUB SPREAD FOR BREAD MARAGARINE SALTED UPFIELD GHANA MANUFACTURING LIMITED"
JSON: {"BARCODE": "6034000482027", "BRAND": "BLUE BAND", "VARIANT": "ORIGINAL", "TYPE": "SALTED MARGARINE", "FRAGRANCE_FLAVOR": "", "PROMOTION": "", "ADDONS": "", "TAGLINE": "LOW FAT SPREAD FOR BREAD"}

Example 2:
OCR Text: "LELE MAYONNAISE 430G GLASS TUB BOTTLE MAYONNAISE AJC GHANA"
JSON: {"BARCODE": "106060069411", "BRAND": "LELE", "VARIANT": "", "TYPE": "MAYONNAISE", "FRAGRANCE_FLAVOR": "", "PROMOTION": "", "ADDONS": "", "TAGLINE": ""}

Example 3:
OCR Text: "MAGGI JOLLOF SEASONING PWDR 8G SACHET NESTLE NIGERIA LTD"
JSON: {"BARCODE": "6151100033369", "BRAND": "MAGGI", "VARIANT": "", "TYPE": "POWDER", "FRAGRANCE_FLAVOR": "JOLLOF", "PROMOTION": "", "ADDONS": "", "TAGLINE": ""}
-------------------------

Here is the exact raw text extracted from this image by an enterprise OCR engine:
---
${ocrText || "No OCR text provided."}
---
${ocrText ? "Use the image for visual layout context, but RELY ENTIRELY on the provided OCR text for the exact spelling of words. Do not hallucinate words that are not in the OCR text!" : "No OCR text was provided. You must read the text directly from the image."}
Return ONLY valid JSON. Do not wrap in markdown blocks.`;
    } else {
        prompt = `You are a precise product data extraction assistant. Extract product details as a JSON object with EXACTLY these fields:
ITEM_NAME, BARCODE, MANUFACTURER, BRAND, WEIGHT, PACKAGING_TYPE, COUNTRY, VARIANT, TYPE, FRAGRANCE_FLAVOR, PROMOTION, ADDONS, TAGLINE, imageTag.
ALSO, output a nested object named "fieldConfidence" containing a float (0.0 to 1.0) representing your mathematical certainty for each extracted field.
Note 1 (CRITICAL): imageTag MUST be the unique serial tag printed on the edge/margin of the photo (e.g., "GH000364912 U-FRESH ORANGE 350ML BOTTLE PLASTIC U-FRESH COMPANY LIMITED"). Extract the COMPLETE string — every word from the audit ID through to the end of the watermark line — do NOT truncate or stop early. EXCLUDE only the final side word (Front/Back/Left/Right/Barcode) if present. DO NOT copy or hallucinate the example tag "GH000364912" if you cannot see a watermark on the image. If you cannot clearly read the watermark on the image, output an empty string "".
Note 2: For COUNTRY, look closely for phrases like "Made in [Country]".
Note 3: If text is blurry or not explicitly printed, output an empty string "". DO NOT guess.
Note 4 (CRITICAL): Use the exact raw OCR text below for spelling.

--- FEW-SHOT EXAMPLES ---
Example 1:
OCR Text: "BLUE BAND 250G PLASTIC TUB SPREAD FOR BREAD MARAGARINE SALTED UPFIELD GHANA MANUFACTURING LIMITED"
JSON: {"ITEM_NAME": "BLUE BAND 250G PLASTIC TUB SPREAD FOR BREAD MARAGARINE SALTED UPFIELD GHANA MANUFACTURING LIMITED", "BARCODE": "6034000482027", "MANUFACTURER": "UPFIELD", "BRAND": "BLUE BAND", "WEIGHT": "250G", "PACKAGING_TYPE": "TUB", "COUNTRY": "GHANA", "VARIANT": "ORIGINAL", "TYPE": "SALTED MARGARINE", "FRAGRANCE_FLAVOR": "", "PROMOTION": "", "ADDONS": "", "TAGLINE": "LOW FAT SPREAD FOR BREAD"}

Example 2:
OCR Text: "LELE MAYONNAISE 430G GLASS TUB BOTTLE MAYONNAISE AJC GHANA"
JSON: {"ITEM_NAME": "LELE MAYONNAISE 430G GLASS TUB BOTTLE MAYONNAISE AJC GHANA", "BARCODE": "106060069411", "MANUFACTURER": "AJC TRADING CO LTD", "BRAND": "LELE", "WEIGHT": "430G", "PACKAGING_TYPE": "GLASS JAR", "COUNTRY": "GHANA", "VARIANT": "", "TYPE": "MAYONNAISE", "FRAGRANCE_FLAVOR": "", "PROMOTION": "", "ADDONS": "", "TAGLINE": ""}

Example 3:
OCR Text: "MAGGI JOLLOF SEASONING PWDR 8G SACHET NESTLE NIGERIA LTD"
JSON: {"ITEM_NAME": "MAGGI JOLLOF SEASONING PWDR 8G SACHET NESTLE NIGERIA LTD", "BARCODE": "6151100033369", "MANUFACTURER": "NESTLE", "BRAND": "MAGGI", "WEIGHT": "8G", "PACKAGING_TYPE": "SACHET", "COUNTRY": "NIGERIA", "VARIANT": "", "TYPE": "POWDER", "FRAGRANCE_FLAVOR": "JOLLOF", "PROMOTION": "", "ADDONS": "", "TAGLINE": ""}
-------------------------

Here is the exact raw text extracted from this image by an enterprise OCR engine:
---
${ocrText || "No OCR text provided."}
---
${ocrText ? "Use the image for visual layout context, but RELY ENTIRELY on the provided OCR text for the exact spelling of words. Do not hallucinate words that are not in the OCR text!" : "No OCR text was provided. You must read the text directly from the image."}
Return ONLY valid JSON. Do not wrap in markdown blocks.`;
    }

    const response = await fetch(endpoint, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            model: "qwen3-vl-235b-a22b-instruct",
            messages: [
                {
                    role: "user",
                    content: [
                        { type: "text", text: prompt },
                        { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64Image}` } }
                    ]
                }
            ]
        })
    });

    if (!response.ok) {
        console.error(`[Qwen3-VL] Failed for ${fileName}:`, await response.text());
        return null;
    }

    const data = (await response.json()) as any;
    const content = data.choices[0].message.content;
    
    try {
        let jsonStr = content;

        // Qwen3 thinking models emit <think>...</think> before the actual response.
        // Strip it first so the JSON extraction logic below doesn't find a '{' inside
        // the reasoning block instead of the real output object.
        const thinkStripped = jsonStr.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
        if (thinkStripped) jsonStr = thinkStripped;

        const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) {
            jsonStr = jsonMatch[1];
        } else {
            const start = jsonStr.indexOf("{");
            const end = jsonStr.lastIndexOf("}");
            if (start !== -1 && end !== -1 && end > start) {
                jsonStr = jsonStr.substring(start, end + 1);
            }
        }
        
        const parsed = JSON.parse(jsonStr.trim());
        const fieldConfidence = parsed.fieldConfidence || {};

        const enforceThreshold = (key: string, value: string) => {
            if (value && typeof fieldConfidence[key] === 'number' && fieldConfidence[key] < FIELD_EMPTY_THRESHOLD) {
                return "";
            }
            return value;
        };

        return {
            ITEM_NAME: enforceThreshold("ITEM_NAME", parsed.ITEM_NAME || ""),
            BARCODE: enforceThreshold("BARCODE", parsed.BARCODE || ""),
            MANUFACTURER: enforceThreshold("MANUFACTURER", parsed.MANUFACTURER || ""),
            BRAND: enforceThreshold("BRAND", parsed.BRAND || ""),
            WEIGHT: enforceThreshold("WEIGHT", parsed.WEIGHT || ""),
            PACKAGING_TYPE: enforceThreshold("PACKAGING_TYPE", parsed.PACKAGING_TYPE || ""),
            COUNTRY: enforceThreshold("COUNTRY", parsed.COUNTRY || ""),
            VARIANT: enforceThreshold("VARIANT", parsed.VARIANT || ""),
            TYPE: enforceThreshold("TYPE", parsed.TYPE || ""),
            FRAGRANCE_FLAVOR: enforceThreshold("FRAGRANCE_FLAVOR", parsed.FRAGRANCE_FLAVOR || ""),
            PROMOTION: enforceThreshold("PROMOTION", parsed.PROMOTION || ""),
            ADDONS: enforceThreshold("ADDONS", parsed.ADDONS || ""),
            TAGLINE: enforceThreshold("TAGLINE", parsed.TAGLINE || ""),
            imageTag: parsed.imageTag || "",
            fieldConfidence: fieldConfidence,
            sourceImages: [fileName],
            rawVisionData: { [fileName]: parsed }
        };
    } catch (e) {
        console.error(`[Qwen3-VL] Failed to parse JSON for ${fileName}`, e);
        return null;
    }
}

async function extractWatermarkWithQwen(croppedBase64: string, env: any = null): Promise<string> {
    const apiKey = env?.QWEN_API_KEY || (typeof process !== "undefined" ? process.env.QWEN_API_KEY : undefined);
    const endpoint = env?.QWEN_API_ENDPOINT || (typeof process !== "undefined" ? process.env.QWEN_API_ENDPOINT : undefined) || "https://ws-e8idycj2w4qgstsm.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1/chat/completions";

    if (!apiKey) {
        throw new Error("Missing QWEN_API_KEY for watermark extraction");
    }

    const prompt = `Read the watermark text printed along the edge/margin of this image.
The watermark is typically a single line printed in small text on one edge of the photo. It usually starts with an audit/tracking ID (e.g. GH000413323_B, C1000114615, CI00021421_A) followed by a full product description (e.g. "Zesta Ginger 25+7 Free 57.6g Envelope Teabag box Cardboard Suiza") and sometimes ends with a side word (Front/Back/Left/Right).

CRITICAL RULES:
1. Return the COMPLETE watermark text exactly as printed — do NOT truncate or summarize it.
2. Include every word from the audit ID through to the end of the product description and side label.
3. If you can see a watermark but can only partially read it, output what you can see — do NOT stop early.
4. Return ONLY the raw watermark text on a single line. No explanation, no markdown, no quotes.
5. If you cannot see any watermark text at all, return an empty string.`;

    try {
        const response = await fetch(endpoint, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "qwen3-vl-235b-a22b-instruct",
                messages: [
                    {
                        role: "user",
                        content: [
                            { type: "text", text: prompt },
                            { type: "image_url", image_url: { url: `data:image/jpeg;base64,${croppedBase64}` } }
                        ]
                    }
                ]
            })
        });

        if (!response.ok) {
            console.error("[Qwen3-VL-Watermark] API error:", await response.text());
            return "";
        }

        const data = (await response.json()) as any;
        const raw = data.choices?.[0]?.message?.content ?? "";
        // Strip Qwen3 <think> reasoning block before returning watermark text
        const text = raw.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
        return text;
    } catch (e) {
        console.error("[Qwen3-VL-Watermark] Failed to fetch:", e);
        return "";
    }
}

// ── Post-extraction Sanitization Helpers ────────────────────────────────────

/** Strips divider/label metadata text from ITEM_NAME (e.g. "RETAIL AUDIT", date stamps). */
function sanitizeItemName(name: string): string {
	if (!name) return name;
	// Remove common audit divider/label metadata prefixes
	const cleaned = name
		.replace(/RETAIL\s+AUDIT[^]*?(?=\b[A-Z]{2,}\b)/i, '')
		.replace(/PRODUCT\s+IMAGES[^]*?(?=\b[A-Z]{2,}\b)/i, '')
		// Strip everything up to and including the GMT timestamp
		.replace(/^.*?GMT\s+\d{4}\s*/i, "")
		// Short label prefixes: "MAR-26 - Product..."
		.replace(/^[A-Z]{3,10}-?\d{0,2}\s+-\s+/i, '')
		.trim();
	// If stripping removed too much, return original
	return cleaned.length < 5 ? name : cleaned;
}

/** Detects E-number hallucination sequences in ingredient-like text fields. */
function hasENumberHallucination(text: string): boolean {
	if (!text || text.length < 50) return false;
	const eNumbers = text.match(/\bE\d{3,}\b/g);
	if (!eNumbers || eNumbers.length < 10) return false;
	// Hallucinated E-number lists span a wide range of prefixes (E1xx, E2xx, ..., E9xx)
	const uniquePrefixes = new Set(eNumbers.map(e => e.substring(0, 3)));
	return uniquePrefixes.size >= 5;
}

/** Fields to check for E-number hallucination. */
const E_NUMBER_FIELDS = ['ADDONS', 'FRAGRANCE_FLAVOR', 'TAGLINE', 'TYPE', 'ITEM_NAME'] as const;

/** Clears hallucinated E-number content from extraction fields. */
function clearENumberHallucinations(extracted: IMDBProduct, reporter: JobReporter, fileName: string): void {
	for (const field of E_NUMBER_FIELDS) {
		const val = (extracted as any)[field];
		if (typeof val === 'string' && hasENumberHallucination(val)) {
			reporter.addLog("structured", `[${fileName}] Cleared E-number hallucination in ${field}`, "warning");
			(extracted as any)[field] = '';
		}
	}
}

// ─── Job Processing ─────────────────────────────────────────────────────────

export async function processJob(
	jobId: string,
	orgId: string,
	imageKeys: string[],
	env: any = null,
): Promise<void> {
    const reporter = new JobReporter(env, jobId);
    console.log(`[Pipeline] Starting Job ${jobId} for Organisation ${orgId}`);

    await reporter.updateNodeState("upload", "active");
    await reporter.addLog("upload", `Received Job ${jobId} with ${imageKeys.length} images`, "info");

    try {
        await db.update(jobs).set({ status: "PROCESSING", progress: 10, startedAt: new Date().toISOString() }).where(eq(jobs.id, jobId));

        const rawExtractions: IMDBProduct[] = [];
        let anyWatermarkFound = false;
        const limit = pLimit(5); // 5 concurrent requests to avoid rate limits

        const ocrConfig = getOcrProvider(env);
        let ocrTitle = "No OCR Provider";
        let ocrDesc = "Perception: Skipping OCR pass (no keys found).";
        let ocrBadge = "NONE";

        if (ocrConfig.provider === "rolmocr") {
            ocrTitle = "RolmOCR Transcription";
            ocrDesc = "Perception: High-fidelity document text extraction.";
            ocrBadge = "REDUCTO";
        } else if (ocrConfig.provider === "google") {
            ocrTitle = "Google Cloud Vision";
            ocrDesc = "Perception: Extracts raw text perfectly.";
            ocrBadge = "ENTERPRISE";
        }

        await reporter.updateNodeState("ocr", "active", undefined, undefined, ocrBadge, ocrTitle, ocrDesc);
        await reporter.addLog("ocr", `Running OCR via ${ocrTitle}...`, "info");

        let processed = 0;
        await Promise.all(imageKeys.map(key => limit(async () => {
            const fileName = key.split("/").pop() || key;
            const buffer = await getUpload(orgId, jobId, fileName);
            if (!buffer) {
                await reporter.addLog("upload", `Could not load image: ${fileName}`, "error");
                return;
            }

            const imageHash = await hashImage(buffer);
            const cached = await getCachedExtraction(orgId, imageHash);
            if (cached) {
                const product = JSON.parse(JSON.stringify(cached)) as IMDBProduct;
                
                product.sourceImages = [fileName];
                if (product.rawVisionData) {
                    const newRawVisionData: any = {};
                    for (const k of Object.keys(product.rawVisionData)) {
                        if (k.endsWith("_ocr")) newRawVisionData[`${fileName}_ocr`] = product.rawVisionData[k];
                        else if (k.endsWith("_watermark")) newRawVisionData[`${fileName}_watermark`] = product.rawVisionData[k];
                        else newRawVisionData[fileName] = product.rawVisionData[k];
                    }
                    product.rawVisionData = newRawVisionData;
                    
                    if (newRawVisionData[`${fileName}_watermark`]) {
                        anyWatermarkFound = true;
                    }
                }
                
                rawExtractions.push(product);
                await reporter.addLog("structured", `[${fileName}] Cache HIT — skipped all AI`, "success");
                processed++;
                const progressPercent = Math.min(60, 10 + Math.round((processed / imageKeys.length) * 50));
                await db.update(jobs).set({ progress: progressPercent }).where(eq(jobs.id, jobId));
                return;
            }
			// Step 1: Dedicated watermark scan — crop each edge at high resolution FIRST.
			// The watermark is printed in small text on the image border. Running OCR on
			// an edge-anchored 480px strip upscaled 2× (to 960px) gives OCR engines ~40px
			// character height, which is well within reliable read range.
			// We do this BEFORE the full-image OCR pass so the cleanest possible crop
			// feeds watermark detection — not as a last resort.
			//
			// OPTIMIZATION: Only use OCR (cheap) for edge scanning. The expensive Qwen VL
			// waternark fallback is only called once on the bottom edge at the very end
			// if all OCR attempts failed — saving up to 3 VL calls per image.
			let watermarkData: any = null;
			let bestEdgeOcr = ""; // best edge OCR text for watermark parsing
			let cachedBottomBuffer: ArrayBuffer | null = null;
			if (env?.IMAGES) {
				try {
					const bottomBuffer = await cropImageMargin(buffer, "bottom", env);
					cachedBottomBuffer = bottomBuffer;
					if (bottomBuffer !== buffer) {
						const croppedBase64 = Buffer.from(bottomBuffer).toString("base64");
						let croppedOcr = "";
						if (ocrConfig.provider === "rolmocr") {
							croppedOcr = await extractWithRolmOCR(croppedBase64, env, null, `${fileName}_bottom`);
						} else if (ocrConfig.provider === "google") {
							croppedOcr = await extractWithGoogleVision(croppedBase64, env, null, `${fileName}_bottom`);
						}
						bestEdgeOcr = croppedOcr;
						if (croppedOcr) {
							for (const line of croppedOcr.split('\n')) {
								const parsed = parseWatermark(line);
								// Tightened validation: require auditId OR (productDescription > 10 AND at least one other structured field)
								const hasStrongIdentifiers = parsed && (
									parsed.auditId ||
									(parsed.productDescription.length > 10 && (parsed.weight || parsed.packaging || parsed.manufacturer))
								);
								if (hasStrongIdentifiers) {
									watermarkData = parsed;
									await reporter.addLog("watermark", `[${fileName}] Watermark found on bottom edge (OCR): ${parsed.auditId || 'non-standard ID'}`, "success");
									break;
								}
							}
						}
					}
				} catch (cropErr) {
					console.error(`[Pipeline] Bottom margin crop flow failed:`, cropErr);
				}

				if (!watermarkData) {
					const margins: ("top" | "left" | "right")[] = ["top", "left", "right"];
					const edgeResults = await Promise.allSettled(margins.map(async (margin) => {
						const croppedBuffer = await cropImageMargin(buffer, margin, env);
						if (croppedBuffer === buffer) return { margin, ocr: "", parsed: null };
						const croppedBase64 = Buffer.from(croppedBuffer).toString("base64");
						let croppedOcr = "";
						if (ocrConfig.provider === "rolmocr") {
							croppedOcr = await extractWithRolmOCR(croppedBase64, env, null, `${fileName}_${margin}`);
						} else if (ocrConfig.provider === "google") {
							croppedOcr = await extractWithGoogleVision(croppedBase64, env, null, `${fileName}_${margin}`);
						}
						let parsed: any = null;
						if (croppedOcr) {
							for (const line of croppedOcr.split('\n')) {
								const p = parseWatermark(line);
								// Tightened validation: require auditId OR (productDescription > 10 AND at least one other structured field)
								const hasStrongIdentifiers = p && (
									p.auditId ||
									(p.productDescription.length > 10 && (p.weight || p.packaging || p.manufacturer))
								);
								if (hasStrongIdentifiers) {
									parsed = p;
									break;
								}
							}
						}
						return { margin, ocr: croppedOcr, parsed };
					}));

					for (const res of edgeResults) {
						if (res.status === "fulfilled" && res.value) {
							if (res.value.ocr.length > bestEdgeOcr.length) {
								bestEdgeOcr = res.value.ocr;
							}
							if (!watermarkData && res.value.parsed) {
								watermarkData = res.value.parsed;
								await reporter.addLog("watermark", `[${fileName}] Watermark found on ${res.value.margin} edge (OCR): ${watermarkData.auditId || 'non-standard ID'}${watermarkData.productDescription ? ' - ' + watermarkData.productDescription.substring(0, 40) : ''}`, "success");
							}
						}
					}
				}

				if (!watermarkData && bestEdgeOcr.length < 8 && cachedBottomBuffer && cachedBottomBuffer !== buffer) {
					try {
						const croppedBase64 = Buffer.from(cachedBottomBuffer).toString("base64");
						const qwenResult = await extractWatermarkWithQwen(croppedBase64, env);
						if (qwenResult) {
							for (const line of qwenResult.split('\n')) {
								const parsed = parseWatermark(line);
								// Tightened validation: require auditId OR (productDescription > 10 AND at least one other structured field)
								const hasStrongIdentifiers = parsed && (
									parsed.auditId ||
									(parsed.productDescription.length > 10 && (parsed.weight || parsed.packaging || parsed.manufacturer))
								);
								if (hasStrongIdentifiers) {
									watermarkData = parsed;
									await reporter.addLog("watermark", `[${fileName}] Watermark found on bottom edge (Qwen-VL fallback): ${parsed.auditId || 'non-standard ID'}`, "success");
									break;
								}
							}
						}
					} catch (qwenErr) {
						console.error(`[Pipeline] Qwen VL watermark fallback failed:`, qwenErr);
					}
				}
				if (!watermarkData) {
					await reporter.addLog("watermark", `[${fileName}] No watermark found in any edge crop — will fall back to Qwen imageTag`, "info");
				}
			}

			// Step 2: Full-image OCR for product field extraction.
			// Also used as a secondary watermark source if the edge crop missed it.
			const base64Original = Buffer.from(buffer).toString("base64");
			let ocrText = "";
            if (ocrConfig.provider === "rolmocr") {
                ocrText = await extractWithRolmOCR(base64Original, env, reporter, fileName);
            } else if (ocrConfig.provider === "google") {
                ocrText = await extractWithGoogleVision(base64Original, env, reporter, fileName);
            }

			// If edge crop didn't find a watermark, scan the full-image OCR output as backup
			if (!watermarkData && ocrText) {
				for (const line of ocrText.split('\n')) {
					const parsed = parseWatermark(line);
					if (parsed?.auditId) {
						watermarkData = parsed;
						await reporter.addLog("watermark", `[${fileName}] Watermark found in full-image OCR: ${parsed.auditId}`, "success");
						break;
					}
				}
			}

			// No third fallback — asking Qwen to read watermarks from the full image was removed
			// because it hallucinated fake watermarks that overrode legitimate ITEM_NAME values.
			// Only margin-crop OCR and full-image OCR text are trusted watermark sources.

            // Step 1.8: Background Removal — AFTER watermark extraction, BEFORE Qwen/OCR cognition
            // Original buffer edges (watermark) are safe. cleanBuffer feeds all subsequent AI steps.
            const cleanBuffer = await removeBackground(buffer, env);
            await reporter.addLog("bgremoval", `[${fileName}] Product isolated from shelf background`, "success");

            // Re-run OCR on the clean buffer only if original OCR was suspiciously short
            // (e.g., text was obscured by background clutter). Saves ~1 OCR call per image
            // when the original extraction was already good.
            if (env?.IMAGES && ocrConfig.provider !== "none" && ocrText.length < 20) {
                const base64Clean = Buffer.from(cleanBuffer).toString("base64");
                let cleanOcr = "";
                if (ocrConfig.provider === "rolmocr") {
                    cleanOcr = await extractWithRolmOCR(base64Clean, env, null, `${fileName}_clean`);
                } else if (ocrConfig.provider === "google") {
                    cleanOcr = await extractWithGoogleVision(base64Clean, env, null, `${fileName}_clean`);
                }
                // Use clean OCR if it returned substantially more content
                if (cleanOcr && cleanOcr.length > ocrText.length + 10) {
                    ocrText = cleanOcr;
                    await reporter.addLog("bgremoval", `[${fileName}] Clean OCR produced richer text — using background-removed result`, "success");
                }
            }

            // Step 2: Cognition (Qwen3-VL) — receives clean background-removed buffer if watermark
            // was already found, otherwise receives the original buffer so it can see the watermark margins.
            const cognitionBuffer = watermarkData ? cleanBuffer : buffer;
            const extracted = await extractWithQwen(cognitionBuffer, fileName, ocrText, env, watermarkData);
            if (extracted) {
                // Sanitize hallucinated prompt example tags (e.g. GH000364912)
                if (extracted.imageTag) {
                    extracted.imageTag = extracted.imageTag.replace(/GH000364912/gi, "").trim();
                    extracted.imageTag = extracted.imageTag.replace(/U-FRESH ORANGE 350ML BOTTLE PLASTIC U-FRESH COMPANY LIMITED/gi, "").trim();
                }

                // ── Post-extraction sanitization ─────────────────────────────────────
                // Sanitize ITEM_NAME (strip divider/label metadata) and detect E-number hallucinations
                
                if (watermarkData) {
                    if (watermarkData.productDescription) extracted.ITEM_NAME = sanitizeItemName(watermarkData.productDescription);
                    if (watermarkData.weight) extracted.WEIGHT = watermarkData.weight;
                    if (watermarkData.packaging) extracted.PACKAGING_TYPE = watermarkData.packaging;
                    if (watermarkData.manufacturer) extracted.MANUFACTURER = watermarkData.manufacturer;
                    if (watermarkData.country) extracted.COUNTRY = watermarkData.country;
                    
                    // Overwrite imageTag with the deterministic watermark tag for correct grouping
                    extracted.imageTag = watermarkData.auditId + (watermarkData.productDescription ? " " + watermarkData.productDescription : "");
                    
                    // Attach the side label (Front/Back/Left/Right/Barcode) for side-aware grouping
                    if (watermarkData.side) {
                        extracted.imageSide = watermarkData.side;
                    }
                    
                    if (!extracted.rawVisionData) extracted.rawVisionData = {};
                    extracted.rawVisionData[`${fileName}_watermark`] = watermarkData;
                    
                    anyWatermarkFound = true;
                    await reporter.addLog("watermark", `[${fileName}] Applied deterministic watermark metadata overrides from tag ${watermarkData.auditId}${watermarkData.side ? ` [${watermarkData.side}]` : ""}`, "success");
                } else {
                    // No watermark found — sanitize Qwen's raw extraction
                    extracted.ITEM_NAME = sanitizeItemName(extracted.ITEM_NAME);

                    if (extracted.imageTag) {
                        // Fallback: detect side from Qwen's imageTag if no physical watermark was found
                        // The Qwen prompt instructs it to EXCLUDE side words, but in case it included one:
                        const SIDE_RE = /\b(Front|Back|Left|Right|Top|Bottom|Barcode|First_Side|Second_Side|Side_1|Side_2)\b/i;
                        const sideMatch = extracted.imageTag.match(SIDE_RE);
                        if (sideMatch) {
                            extracted.imageSide = sideMatch[1];
                            extracted.imageTag = extracted.imageTag.replace(SIDE_RE, "").trim();
                        }
                        
                        // If Qwen returned an empty ITEM_NAME, populate it from the raw imageTag
                        if (!extracted.ITEM_NAME || extracted.ITEM_NAME.length < 3) {
                            const parsedTag = parseWatermark(extracted.imageTag);
                            extracted.ITEM_NAME = sanitizeItemName(parsedTag ? parsedTag.productDescription : extracted.imageTag);
                        }
                    }
                }

                // Clear E-number hallucination in any text field (runs in both watermark and non-watermark paths)
                clearENumberHallucinations(extracted, reporter, fileName);

                // Heuristic Brand Fallback
                if (!extracted.BRAND && extracted.ITEM_NAME) {
                    const firstWordMatch = extracted.ITEM_NAME.match(/^[^\s]+/);
                    if (firstWordMatch) {
                        const firstWord = firstWordMatch[0];
                        if (firstWord.length >= 3 && !/^(THE|A|AN|AND|FOR|WITH)$/i.test(firstWord)) {
                            extracted.BRAND = firstWord;
                        }
                    }
                }

                // Attach the OCR text to the product so it saves to the DB later
                if (ocrText) {
                    if (!extracted.rawVisionData) extracted.rawVisionData = {};
                    extracted.rawVisionData[`${fileName}_ocr`] = ocrText;
                    
                    const successMessage = ocrConfig.provider === "rolmocr" 
                        ? `[${fileName}] Raw text transcribed via RolmOCR` 
                        : `[${fileName}] Raw text extracted via Google Vision`;
                    await reporter.addLog("ocr", successMessage, "success");
                }
                rawExtractions.push(extracted);
                await putCachedExtraction(orgId, imageHash, extracted);
                await reporter.addLog("structured", `[${fileName}] Data extracted successfully by Qwen3-VL${extracted.imageSide ? ` (${extracted.imageSide} side)` : ""}`, "success");
            } else {
                await reporter.addLog("structured", `[${fileName}] Failed to extract data`, "error");
            }

            processed++;
            const progressPercent = Math.min(60, 10 + Math.round((processed / imageKeys.length) * 50));
            await db.update(jobs).set({ progress: progressPercent }).where(eq(jobs.id, jobId));
        })));

        await reporter.updateNodeState("ocr", "completed");
        await reporter.updateEdgeState("e1", true, "#10b981");

        // Watermark Parsing phase visual update
        await reporter.updateNodeState("watermark", "active");
        if (anyWatermarkFound) {
            await reporter.addLog("watermark", "Watermark tag override phase completed successfully", "success");
        } else {
            await reporter.addLog("watermark", "No physical watermark tags detected — side-aware grouping still active", "info");
        }
        await reporter.updateNodeState("watermark", "completed");
        await reporter.updateEdgeState("e_ocr", true, "#10b981");

        // BG Removal phase visual update
        await reporter.updateNodeState("bgremoval", "active");
        await reporter.addLog("bgremoval", `Background removal applied to all ${imageKeys.length} images`, "success");
        await reporter.updateNodeState("bgremoval", "completed");
        await reporter.updateEdgeState("e_watermark_bg", true, "#10b981");

        // Structured Extraction phase visual update (was already run per-image inside the loop)
        await reporter.updateNodeState("structured", "active");
        await reporter.updateNodeState("structured", "completed");
        await reporter.updateEdgeState("e_bg_structured", true, "#10b981");

        await reporter.updateNodeState("grouping", "active");
        await reporter.addLog("grouping", `Grouping ${rawExtractions.length} extractions...`, "info");

        // 2. Intelligent Grouping
        const mergedProducts = await groupAndMergeImages(rawExtractions);
        
        await reporter.updateNodeState("grouping", "completed");
        await reporter.updateEdgeState("e2", true, "#10b981");
        await reporter.addLog("grouping", `Grouped into ${mergedProducts.length} unique products`, "success");
        await reporter.updateNodeState("database", "active");

        // 3. Save to Database
        const newRecordIds: string[] = [];
        const recordsToInsert = [];
        for (const product of mergedProducts) {
            const recordId = crypto.randomUUID();
            newRecordIds.push(recordId);

            const isMissingCritical = !product.BARCODE || !product.ITEM_NAME || !product.BRAND;
            
            const fieldMeta: Record<string, any> = {};
            let weightedTotalConf = 0;
            let totalWeight = 0;
            
            if (product.fieldConfidence) {
                for (const key of Object.keys(product.fieldConfidence)) {
                    if ((product as any)[key]) { // Only count if the field actually has a value
                        const val = product.fieldConfidence[key];
                        const w = FIELD_WEIGHTS[key as keyof typeof FIELD_WEIGHTS] || 0.1;
                        weightedTotalConf += (val * w);
                        totalWeight += w;
                        fieldMeta[key] = { value: (product as any)[key], source: "AI Extraction Pipeline", confidence: val };
                    }
                }
            }
            
            let confidence = totalWeight > 0 ? (weightedTotalConf / totalWeight) : 0;
            
            // Fallback to old density calculation if AI didn't provide fieldConfidence
            if (totalWeight === 0) {
                const filledFieldsCount = Object.keys(product).filter(k => 
                    k !== "imageTag" && k !== "sourceImages" && !!(product as any)[k]
                ).length;
                confidence = Math.round((filledFieldsCount / 13) * 100) / 100;
            }
            
            // Penalize confidence if critical fields are missing
            if (isMissingCritical) {
                confidence = Math.min(confidence, 0.70);
            }
            if (product.BARCODE) {
                const cleanedBarcode = normalizeBarcode(product.BARCODE);
                if (cleanedBarcode.length === 13 && !isValidEAN13(cleanedBarcode)) {
                    confidence = Math.min(confidence, 0.70);
                }
            }
            
            const flagged = confidence < 0.75;

            recordsToInsert.push({
                id: recordId,
                jobId,
                organisationId: orgId,
                ITEM_NAME: (product.ITEM_NAME || "").toUpperCase(),
                BARCODE: product.BARCODE ? normalizeBarcode(product.BARCODE) : "",
                MANUFACTURER: product.MANUFACTURER ? normalizeManufacturer(product.MANUFACTURER) : "",
                BRAND: product.BRAND ? normalizeBrand(product.BRAND) : "",
                WEIGHT: product.WEIGHT ? normalizeWeight(product.WEIGHT) : "",
                PACKAGING_TYPE: product.PACKAGING_TYPE ? normalizePackaging(product.PACKAGING_TYPE, product.BRAND) : "",
                COUNTRY: product.COUNTRY ? normalizeCountry(product.COUNTRY) : "",
                VARIANT: (product.VARIANT || "").toUpperCase(),
                TYPE: (product.TYPE || "").toUpperCase(),
                FRAGRANCE_FLAVOR: (product.FRAGRANCE_FLAVOR || "").toUpperCase(),
                PROMOTION: (product.PROMOTION || "").toUpperCase(),
                ADDONS: (product.ADDONS || "").toUpperCase(),
                TAGLINE: (product.TAGLINE || "").toUpperCase(),
                confidence,
                flagged,
                rawExtraction: { 
                    images: product.sourceImages.map(f => ({ 
                        fileName: f, 
                        ocr: product.rawVisionData ? product.rawVisionData[`${f}_ocr`] || null : null, 
                        zxing: null, 
                        vision: product.rawVisionData ? product.rawVisionData[f] : null,
                        watermark: product.rawVisionData ? product.rawVisionData[`${f}_watermark`] || null : null
                    })) 
                },
                fieldMetadata: fieldMeta, 
                productGroupKey: product.imageTag || product.BARCODE || "unknown",
            });
        }

        if (recordsToInsert.length > 0) {
            const CHUNK = 20;
            const chunks: any[] = [];
            for (let i = 0; i < recordsToInsert.length; i += CHUNK) chunks.push(recordsToInsert.slice(i, i + CHUNK));
            await db.transaction(async (tx: any) => {
                await Promise.all(chunks.map(c => tx.insert(imdbRecords).values(c)));
            });
        }

        await reporter.updateNodeState("database", "completed");
        await reporter.updateEdgeState("e3", true, "#10b981");
        await reporter.updateNodeState("deduplication", "active");

        // 4. Merge Suggestions (Duplicate Detection)
        const newRecords = await db.select().from(imdbRecords).where(and(eq(imdbRecords.jobId, jobId), eq(imdbRecords.organisationId, orgId)));
        
        const newBarcodes = [...new Set(newRecords.map((r: any) => normalizeField("BARCODE", r.BARCODE)).filter(Boolean))] as string[];
        const barcodeMatches = newBarcodes.length
            ? await db.select().from(imdbRecords).where(and(
                eq(imdbRecords.organisationId, orgId),
                eq(imdbRecords.status, "ACTIVE"),
                ne(imdbRecords.jobId, jobId),
                inArray(imdbRecords.BARCODE, newBarcodes),
            ))
            : [];
            
        const barcodeMatchMap = new Map<string, typeof barcodeMatches>();
        for (const match of barcodeMatches) {
            const bc = normalizeField("BARCODE", match.BARCODE);
            if (!barcodeMatchMap.has(bc)) barcodeMatchMap.set(bc, []);
            barcodeMatchMap.get(bc)!.push(match);
        }

        const existingRecords = await db.select().from(imdbRecords).where(and(eq(imdbRecords.organisationId, orgId), eq(imdbRecords.status, "ACTIVE"), ne(imdbRecords.jobId, jobId)));
        
        const dupInserts: any[] = [];
        for (const newRec of newRecords) {
            const newBarcode = normalizeField("BARCODE", newRec.BARCODE);
            const barcodeMatchedExistingIds = new Set<string>();

            if (newBarcode && barcodeMatchMap.has(newBarcode)) {
                for (const existing of barcodeMatchMap.get(newBarcode)!) {
                    barcodeMatchedExistingIds.add(existing.id);
                    dupInserts.push({
                        id: crypto.randomUUID(),
                        orgId,
                        recordAId: newRec.id,
                        recordBId: existing.id,
                        similarityScore: 1.0,
                        reason: "BARCODE_MATCH",
                        status: "PENDING",
                    });
                }
            }

            for (const existing of existingRecords) {
                if (barcodeMatchedExistingIds.has(existing.id)) continue;

                const newName = normalizeField("ITEM_NAME", newRec.ITEM_NAME).toLowerCase();
                const existingName = normalizeField("ITEM_NAME", existing.ITEM_NAME).toLowerCase();
                const newBrand = normalizeField("BRAND", newRec.BRAND);
                const existingBrand = normalizeField("BRAND", existing.BRAND);

                if (newName && existingName && isSafeSubstringMatch(newName, existingName, newBrand.toLowerCase(), existingBrand.toLowerCase())) {
                    dupInserts.push({
                        id: crypto.randomUUID(),
                        orgId,
                        recordAId: newRec.id,
                        recordBId: existing.id,
                        similarityScore: 0.9,
                        reason: "NAME_MATCH",
                        status: "PENDING",
                    });
                    continue;
                }

                if (newBrand && existingBrand && newBrand.toLowerCase() === existingBrand.toLowerCase() && newRec.WEIGHT === existing.WEIGHT) {
                    // FRAGRANCE_FLAVOR conflict guard
                    if (newRec.FRAGRANCE_FLAVOR && existing.FRAGRANCE_FLAVOR && newRec.FRAGRANCE_FLAVOR.toLowerCase() !== existing.FRAGRANCE_FLAVOR.toLowerCase()) {
                        continue;
                    }
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

        if (dupInserts.length > 0) {
            await db.transaction(async (tx: any) => {
                for (let i = 0; i < dupInserts.length; i += 50) {
                    await tx.insert(duplicatePairs).values(dupInserts.slice(i, i + 50));
                }
            });
            await reporter.addLog("deduplication", `Found ${dupInserts.length} potential duplicate pairs`, "warning");
        }

        await reporter.updateNodeState("deduplication", "completed");
        await reporter.updateEdgeState("e4", true, "#10b981");

        await invalidateStats(orgId);

        await db.update(jobs).set({
            status: "COMPLETED",
            progress: 100,
            completedAt: new Date().toISOString(),
        }).where(eq(jobs.id, jobId));

        console.log(`[Pipeline] Job ${jobId} finished successfully!`);
    } catch (err: any) {
        console.error(`[Pipeline] Job ${jobId} failed:`, err);
        await db.update(jobs).set({
            status: "FAILED",
            progress: 100,
            error: err?.message || String(err),
            completedAt: new Date().toISOString(),
        }).where(eq(jobs.id, jobId));
        await reporter.addLog("upload", `Job Failed: ${err?.message}`, "error");
        await reporter.updateNodeState("upload", "failed");
    }
}
