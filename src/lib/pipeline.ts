import { db } from "../db/index.ts";
import { jobs, imdbRecords, duplicatePairs } from "../db/schema.ts";
import { eq, and, ne } from "drizzle-orm";
import pLimit from "p-limit";
import type { IMDBProduct } from "../types/imdb.ts";
import { getUpload } from "./storage.ts";
import { groupAndMergeImages } from "./grouping.ts";
import { normalizeBarcode, normalizeField } from "./normalization.ts";

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

	async updateNodeState(nodeId: string, status: string, processedCount?: number, totalCount?: number, badge?: string) {
		if (!this.stub) return;
		try {
			await this.stub.updateNodeState(nodeId, status as any, processedCount, totalCount, badge);
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

async function extractWithQwen(imageBuffer: ArrayBuffer, fileName: string, env: any = null): Promise<IMDBProduct | null> {
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
Note 1: imageTag is the watermark or text at the very bottom of the image (e.g. maverick research ID or GH1234...).
Note 2: For COUNTRY, look closely for phrases like "Made in [Country]", "Produced in [Country]", or "Product of [Country]".
Note 3: If text is blurry, illegible, or not explicitly printed on the package, you MUST output an empty string "". DO NOT guess, infer, or hallucinate missing values.
Return ONLY valid JSON. Do not wrap in markdown blocks.`;

    const response = await fetch(endpoint, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            model: "qwen-vl-max-latest",
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
            sourceImages: [fileName],
            rawVisionData: { [fileName]: parsed }
        };
    } catch (e) {
        console.error(`[Qwen3-VL] Failed to parse JSON for ${fileName}`, e);
        return null;
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
        const limit = pLimit(5); // 5 concurrent requests to avoid rate limits

        await reporter.addLog("structured", `Extracting data from ${imageKeys.length} images using Qwen3-VL...`, "info");
        await reporter.updateNodeState("structured", "active");

        let processed = 0;
        await Promise.all(imageKeys.map(key => limit(async () => {
            const fileName = key.split("/").pop() || key;
            const buffer = await getUpload(orgId, jobId, fileName);
            if (!buffer) {
                await reporter.addLog("upload", `Could not load image: ${fileName}`, "error");
                return;
            }

            const extracted = await extractWithQwen(buffer, fileName, env);
            if (extracted) {
                rawExtractions.push(extracted);
                await reporter.addLog("structured", `[${fileName}] Data extracted successfully`, "success");
            } else {
                await reporter.addLog("structured", `[${fileName}] Failed to extract data`, "error");
            }

            processed++;
            const progressPercent = Math.min(60, 10 + Math.round((processed / imageKeys.length) * 50));
            await db.update(jobs).set({ progress: progressPercent }).where(eq(jobs.id, jobId));
        })));

        await reporter.updateNodeState("structured", "completed");
        await reporter.updateEdgeState("e1", true, "#10b981");
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
            const filledFieldsCount = Object.keys(product).filter(k => 
                k !== "imageTag" && k !== "sourceImages" && !!(product as any)[k]
            ).length;
            const totalFields = 13;
            let confidence = Math.round((filledFieldsCount / totalFields) * 100) / 100;
            
            // Penalize confidence if critical fields are missing
            if (isMissingCritical) {
                confidence = Math.min(confidence, 0.70);
            }
            
            const flagged = confidence < 0.75;

            await db.insert(imdbRecords).values({
                id: recordId,
                jobId,
                organisationId: orgId,
                ITEM_NAME: product.ITEM_NAME || "",
                BARCODE: product.BARCODE ? normalizeBarcode(product.BARCODE) : "",
                MANUFACTURER: product.MANUFACTURER || "",
                BRAND: product.BRAND || "",
                WEIGHT: product.WEIGHT || "",
                PACKAGING_TYPE: product.PACKAGING_TYPE || "",
                COUNTRY: product.COUNTRY || "",
                VARIANT: product.VARIANT || "",
                TYPE: product.TYPE || "",
                FRAGRANCE_FLAVOR: product.FRAGRANCE_FLAVOR || "",
                PROMOTION: product.PROMOTION || "",
                ADDONS: product.ADDONS || "",
                TAGLINE: product.TAGLINE || "",
                confidence,
                flagged,
                rawExtraction: { 
                    images: product.sourceImages.map(f => ({ 
                        fileName: f, 
                        ocr: null, 
                        zxing: null, 
                        vision: product.rawVisionData ? product.rawVisionData[f] : null 
                    })) 
                },
                fieldMetadata: {} as any, 
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
