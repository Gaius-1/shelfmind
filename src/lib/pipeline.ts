import { db } from "../db/index.ts";
import { jobs, imdbRecords, duplicatePairs } from "../db/schema.ts";
import { eq, and, ne } from "drizzle-orm";
import pLimit from "p-limit";
import type { IMDBProduct } from "../types/imdb.ts";
import { getUpload } from "./storage.ts";
import { groupAndMergeImages } from "./grouping.ts";
import { normalizeBarcode, normalizeWeight, normalizePackaging, normalizeCountry, normalizeField, normalizeManufacturer, normalizeBrand } from "./normalization.ts";
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

	async updateNodeState(nodeId: string, status: string, processedCount?: number, totalCount?: number, badge?: string, title?: string, description?: string) {
		if (!this.stub) return;
		try {
			await this.stub.updateNodeState(nodeId, status as any, processedCount, totalCount, badge, title, description);
		} catch (e) {}
	}

	async updateEdgeState(edgeId: string, animated: boolean, color: string) {
		if (!this.stub) return;
		try {
			await this.stub.updateEdgeState(edgeId, animated, color);
		} catch (e) {}
	}

	async addLog(nodeId: string, message: string, logType: "info" | "success" | "warning" | "error") {
		if (!this.stub) return;
		try {
			await this.stub.addLog(nodeId, message, logType);
		} catch (e) {}
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

        const data = await response.json();
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

        const data = await response.json();
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
			cropOptions.height = 960;
		} else if (margin === "top") {
			cropOptions.gravity = { x: 0.5, y: 0.0 }; // anchor to very top edge
			cropOptions.width = 3200;
			cropOptions.height = 960;
		} else if (margin === "left") {
			cropOptions.gravity = { x: 0.0, y: 0.5 }; // anchor to very left edge
			cropOptions.width = 960;
			cropOptions.height = 3200;
		} else if (margin === "right") {
			cropOptions.gravity = { x: 1.0, y: 0.5 }; // anchor to very right edge
			cropOptions.width = 960;
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

async function extractWithQwen(imageBuffer: ArrayBuffer, fileName: string, ocrText: string, env: any = null): Promise<IMDBProduct | null> {
    const base64Image = Buffer.from(imageBuffer).toString("base64");
    
    // Read from Cloudflare env bindings if available, otherwise fallback to process.env
    const apiKey = env?.QWEN_API_KEY || (typeof process !== "undefined" ? process.env.QWEN_API_KEY : undefined);
    const endpoint = env?.QWEN_API_ENDPOINT || (typeof process !== "undefined" ? process.env.QWEN_API_ENDPOINT : undefined) || "https://ws-vediqvqa7d9er2yt.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1/chat/completions";

    if (!apiKey) {
        console.error("[Qwen3-VL] Missing QWEN_API_KEY in environment");
        return null;
    }

    const prompt = `You are a precise product data extraction assistant. Extract product details as a JSON object with EXACTLY these fields:
ITEM_NAME, BARCODE, MANUFACTURER, BRAND, WEIGHT, PACKAGING_TYPE, COUNTRY, VARIANT, TYPE, FRAGRANCE_FLAVOR, PROMOTION, ADDONS, TAGLINE, imageTag.
ALSO, output a nested object named "fieldConfidence" containing a float (0.0 to 1.0) representing your mathematical certainty for each extracted field.
Note 1 (CRITICAL): imageTag MUST be the unique serial tag printed on the edge/margin of the photo (e.g., "GH000364912 U-FRESH ORANGE 350ML..."). Extract the ENTIRE string, but EXCLUDE words like "Front", "Back", "Left", or "Right". DO NOT copy or hallucinate the example tag "GH000364912" if you cannot see a watermark on the image. If you cannot clearly read the watermark on the image, output an empty string "".
Note 2: For COUNTRY, look closely for phrases like "Made in [Country]".
Note 3: If text is blurry or not explicitly printed, output an empty string "". DO NOT guess.
Note 4 (CRITICAL): Use the exact raw OCR text below for spelling.

--- FEW-SHOT EXAMPLES ---
Example 1:
OCR Text: "BLUE BAND 250G PLASTIC TUB SPREAD FOR BREAD MARAGARINE SALTED UPFIELD GHANA MANUFACTURING LIMITED"
JSON: {"ITEM_NAME": "BLUE BAND 250G PLASTIC TUB SPREAD FOR BREAD MARAGARINE SALTED", "BARCODE": "6034000482027", "MANUFACTURER": "UPFIELD", "BRAND": "BLUE BAND", "WEIGHT": "250G", "PACKAGING_TYPE": "TUB", "COUNTRY": "GHANA", "VARIANT": "ORIGINAL", "TYPE": "SALTED MARGARINE", "FRAGRANCE_FLAVOR": "", "PROMOTION": "", "ADDONS": "", "TAGLINE": "LOW FAT SPREAD FOR BREAD"}

Example 2:
OCR Text: "LELE MAYONNAISE 430G GLASS TUB BOTTLE MAYONNAISE AJC GHANA"
JSON: {"ITEM_NAME": "LELE MAYONNAISE 430G GLASS TUB BOTTLE MAYONNAISE", "BARCODE": "106060069411", "MANUFACTURER": "AJC TRADING CO LTD", "BRAND": "LELE", "WEIGHT": "430G", "PACKAGING_TYPE": "GLASS JAR", "COUNTRY": "GHANA", "VARIANT": "", "TYPE": "MAYONNAISE", "FRAGRANCE_FLAVOR": "", "PROMOTION": "", "ADDONS": "", "TAGLINE": ""}

Example 3:
OCR Text: "MAGGI JOLLOF SEASONING PWDR 8G SACHET NESTLE NIGERIA LTD"
JSON: {"ITEM_NAME": "MAGGI JOLLOF SEASONING PWDR 8G SACHET", "BARCODE": "6151100033369", "MANUFACTURER": "NESTLE", "BRAND": "MAGGI", "WEIGHT": "8G", "PACKAGING_TYPE": "SACHET", "COUNTRY": "NIGERIA", "VARIANT": "", "TYPE": "POWDER", "FRAGRANCE_FLAVOR": "JOLLOF", "PROMOTION": "", "ADDONS": "", "TAGLINE": ""}
-------------------------

Here is the exact raw text extracted from this image by an enterprise OCR engine:
---
${ocrText || "No OCR text provided."}
---
${ocrText ? "Use the image for visual layout context, but RELY ENTIRELY on the provided OCR text for the exact spelling of words. Do not hallucinate words that are not in the OCR text!" : "No OCR text was provided. You must read the text directly from the image."}
Return ONLY valid JSON. Do not wrap in markdown blocks.`;

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

    const data = await response.json();
    const content = data.choices[0].message.content;
    
    try {
        let jsonStr = content;
        const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) jsonStr = jsonMatch[1];
        else {
            const start = content.indexOf("{");
            const end = content.lastIndexOf("}");
            if (start !== -1 && end !== -1 && end > start) {
                jsonStr = content.substring(start, end + 1);
            }
        }
        
        const parsed = JSON.parse(jsonStr.trim());
        return {
            ITEM_NAME: parsed.ITEM_NAME || "",
            BARCODE: parsed.BARCODE || "",
            MANUFACTURER: parsed.MANUFACTURER || "",
            BRAND: parsed.BRAND || "",
            WEIGHT: parsed.WEIGHT || "",
            PACKAGING_TYPE: parsed.PACKAGING_TYPE || "",
            COUNTRY: parsed.COUNTRY || "",
            VARIANT: parsed.VARIANT || "",
            TYPE: parsed.TYPE || "",
            FRAGRANCE_FLAVOR: parsed.FRAGRANCE_FLAVOR || "",
            PROMOTION: parsed.PROMOTION || "",
            ADDONS: parsed.ADDONS || "",
            TAGLINE: parsed.TAGLINE || "",
            imageTag: parsed.imageTag || "",
            fieldConfidence: parsed.fieldConfidence || {},
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
    const endpoint = env?.QWEN_API_ENDPOINT || (typeof process !== "undefined" ? process.env.QWEN_API_ENDPOINT : undefined) || "https://ws-vediqvqa7d9er2yt.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1/chat/completions";

    if (!apiKey) {
        console.error("[Qwen3-VL] Missing QWEN_API_KEY for watermark extraction");
        return "";
    }

    const prompt = `Read the watermark text printed along the edge/margin of this cropped image. 
The watermark text typically consists of an audit ID (e.g. starting with GH, C, etc.) followed by some product descriptions or other words.
Return ONLY the exact text printed on the image margin. If you cannot see any readable text or watermark, return an empty string "". Do not explain or add commentary.`;

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

        const data = await response.json();
        const text = data.choices?.[0]?.message?.content || "";
        return text.trim();
    } catch (e) {
        console.error("[Qwen3-VL-Watermark] Failed to fetch:", e);
        return "";
    }
}

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
            }			// Step 1: Dedicated watermark scan — crop each edge at high resolution FIRST.
			// The watermark is printed in small text on the image border. Running OCR on
			// an edge-anchored 480px strip upscaled 2× (to 960px) gives OCR engines ~40px
			// character height, which is well within reliable read range.
			// We do this BEFORE the full-image OCR pass so the cleanest possible crop
			// feeds watermark detection — not as a last resort.
			let watermarkData: any = null;
			if (env?.IMAGES) {
				const margins: ("bottom" | "top" | "left" | "right")[] = ["bottom", "top", "left", "right"];
				for (const margin of margins) {
					try {
						const croppedBuffer = await cropImageMargin(buffer, margin, env);
						if (croppedBuffer === buffer) continue; // crop failed, skip
						const croppedBase64 = Buffer.from(croppedBuffer).toString("base64");
						let croppedOcr = "";
						if (ocrConfig.provider === "rolmocr") {
							croppedOcr = await extractWithRolmOCR(croppedBase64, env, null, `${fileName}_${margin}`);
						} else if (ocrConfig.provider === "google") {
							croppedOcr = await extractWithGoogleVision(croppedBase64, env, null, `${fileName}_${margin}`);
						}
						if (!croppedOcr) {
							croppedOcr = await extractWatermarkWithQwen(croppedBase64, env);
						}
						if (croppedOcr) {
							for (const line of croppedOcr.split('\n')) {
								const parsed = parseWatermark(line);
								if (parsed?.auditId) {
									watermarkData = parsed;
									await reporter.addLog("watermark", `[${fileName}] Watermark found on ${margin} edge (480px×2× crop): ${parsed.auditId}`, "success");
									break;
								}
							}
						}
					} catch (cropErr) {
						console.error(`[Pipeline] Margin crop flow failed for ${margin}:`, cropErr);
					}
					if (watermarkData) break;
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

            // Step 1.8: Background Removal — AFTER watermark extraction, BEFORE Qwen/OCR cognition
            // Original buffer edges (watermark) are safe. cleanBuffer feeds all subsequent AI steps.
            const cleanBuffer = await removeBackground(buffer, env);
            await reporter.addLog("bgremoval", `[${fileName}] Product isolated from shelf background`, "success");

            // Re-run OCR on the clean buffer for better field text accuracy (less neighbor-label noise)
            if (env?.IMAGES && ocrConfig.provider !== "none") {
                const base64Clean = Buffer.from(cleanBuffer).toString("base64");
                let cleanOcr = "";
                if (ocrConfig.provider === "rolmocr") {
                    cleanOcr = await extractWithRolmOCR(base64Clean, env, null, `${fileName}_clean`);
                } else if (ocrConfig.provider === "google") {
                    cleanOcr = await extractWithGoogleVision(base64Clean, env, null, `${fileName}_clean`);
                }
                // Merge: prefer clean OCR if it returned more content, otherwise keep original
                if (cleanOcr && cleanOcr.length > ocrText.length) {
                    ocrText = cleanOcr;
                    await reporter.addLog("bgremoval", `[${fileName}] Clean OCR produced richer text — using background-removed result`, "success");
                }
            }

            // Step 2: Cognition (Qwen3-VL) — receives clean background-removed buffer if watermark
            // was already found, otherwise receives the original buffer so it can see the watermark margins.
            const cognitionBuffer = watermarkData ? cleanBuffer : buffer;
            const extracted = await extractWithQwen(cognitionBuffer, fileName, ocrText, env);
            if (extracted) {
                // Sanitize hallucinated prompt example tags (e.g. GH000364912)
                if (extracted.imageTag && (extracted.imageTag.includes("GH000364912") || extracted.imageTag.toUpperCase().includes("U-FRESH ORANGE"))) {
                    extracted.imageTag = "";
                }

                if (watermarkData) {
                    if (watermarkData.productDescription) extracted.ITEM_NAME = watermarkData.productDescription;
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
                } else if (extracted.imageTag) {
                    // Fallback: detect side from Qwen's imageTag if no physical watermark was found
                    // The Qwen prompt instructs it to EXCLUDE side words, but in case it included one:
                    const SIDE_RE = /\b(Front|Back|Left|Right|Top|Bottom|Barcode|First_Side|Second_Side|Side_1|Side_2)\b/i;
                    const sideMatch = extracted.imageTag.match(SIDE_RE);
                    if (sideMatch) {
                        extracted.imageSide = sideMatch[1];
                        extracted.imageTag = extracted.imageTag.replace(SIDE_RE, "").trim();
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
        for (const product of mergedProducts) {
            const recordId = crypto.randomUUID();
            newRecordIds.push(recordId);

            const isMissingCritical = !product.BARCODE || !product.ITEM_NAME || !product.BRAND;
            
            const fieldMeta: Record<string, any> = {};
            let totalConf = 0;
            let confCount = 0;
            
            if (product.fieldConfidence) {
                for (const key of Object.keys(product.fieldConfidence)) {
                    if ((product as any)[key]) { // Only count if the field actually has a value
                        const val = product.fieldConfidence[key];
                        totalConf += val;
                        confCount++;
                        fieldMeta[key] = { value: (product as any)[key], source: "AI Extraction Pipeline", confidence: val };
                    }
                }
            }
            
            let confidence = confCount > 0 ? (totalConf / confCount) : 0;
            
            // Fallback to old density calculation if AI didn't provide fieldConfidence
            if (confCount === 0) {
                const filledFieldsCount = Object.keys(product).filter(k => 
                    k !== "imageTag" && k !== "sourceImages" && !!(product as any)[k]
                ).length;
                confidence = Math.round((filledFieldsCount / 13) * 100) / 100;
            }
            
            // Penalize confidence if critical fields are missing
            if (isMissingCritical) {
                confidence = Math.min(confidence, 0.70);
            }
            
            const flagged = confidence < 0.75;

            await db.insert(imdbRecords).values({
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
            await reporter.addLog("database", `Saved record: ${product.ITEM_NAME || product.BARCODE}`, "success");
        }

        await reporter.updateNodeState("database", "completed");
        await reporter.updateEdgeState("e3", true, "#10b981");
        await reporter.updateNodeState("deduplication", "active");

        // 4. Merge Suggestions (Duplicate Detection)
        const newRecords = await db.select().from(imdbRecords).where(and(eq(imdbRecords.jobId, jobId), eq(imdbRecords.organisationId, orgId)));
        const existingRecords = await db.select().from(imdbRecords).where(and(eq(imdbRecords.organisationId, orgId), eq(imdbRecords.status, "ACTIVE"), ne(imdbRecords.jobId, jobId)));
        
        const dupInserts = [];
        for (const newRec of newRecords) {
            for (const existing of existingRecords) {
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
                    continue;
                }

                const newBrand = normalizeField("BRAND", newRec.BRAND);
                const existingBrand = normalizeField("BRAND", existing.BRAND);
                if (newBrand && existingBrand && newBrand.toLowerCase() === existingBrand.toLowerCase() && newRec.WEIGHT === existing.WEIGHT) {
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
            for (const dup of dupInserts) {
                await db.insert(duplicatePairs).values(dup);
            }
            await reporter.addLog("deduplication", `Found ${dupInserts.length} potential duplicate pairs`, "warning");
        }

        await reporter.updateNodeState("deduplication", "completed");
        await reporter.updateEdgeState("e4", true, "#10b981");

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
