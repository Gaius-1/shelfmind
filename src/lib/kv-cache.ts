import { getBinding } from "./cloudflare.ts";
import type { IMDBProduct } from "../types/imdb.ts";
import type { StatsPayload } from "../routes/api/stats.ts";

export const EXTRACTION_TTL = 7 * 24 * 60 * 60; // 7 days
export const STATS_TTL = 60; // 60 seconds

function getCache(): any {
  return getBinding("CACHE");
}

export async function hashImage(buffer: ArrayBuffer | Buffer | Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", buffer as Uint8Array);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("");
}

export async function getCachedExtraction(orgId: string, imageHash: string): Promise<IMDBProduct | null> {
  const cache = getCache();
  if (!cache) return null;
  try {
    const raw = await cache.get(`ai:${orgId}:${imageHash}`);
    return raw ? (JSON.parse(raw) as IMDBProduct) : null;
  } catch (e) {
    console.error("[KV Cache] getCachedExtraction failed:", e);
    return null;
  }
}

export async function putCachedExtraction(orgId: string, imageHash: string, product: IMDBProduct): Promise<void> {
  const cache = getCache();
  if (!cache) return;
  try {
    await cache.put(`ai:${orgId}:${imageHash}`, JSON.stringify(product), {
      expirationTtl: EXTRACTION_TTL,
    });
  } catch (e) {
    console.error("[KV Cache] putCachedExtraction failed:", e);
  }
}

export async function getCachedStats(orgId: string): Promise<StatsPayload | null> {
  const cache = getCache();
  if (!cache) return null;
  try {
    const raw = await cache.get(`stats:${orgId}`);
    return raw ? (JSON.parse(raw) as StatsPayload) : null;
  } catch (e) {
    console.error("[KV Cache] getCachedStats failed:", e);
    return null;
  }
}

export async function putCachedStats(orgId: string, payload: StatsPayload): Promise<void> {
  const cache = getCache();
  if (!cache) return;
  try {
    await cache.put(`stats:${orgId}`, JSON.stringify(payload), {
      expirationTtl: STATS_TTL,
    });
  } catch (e) {
    console.error("[KV Cache] putCachedStats failed:", e);
  }
}

export async function invalidateStats(orgId: string): Promise<void> {
  const cache = getCache();
  if (!cache) return;
  try {
    await cache.delete(`stats:${orgId}`);
  } catch (e) {
    console.error("[KV Cache] invalidateStats failed:", e);
  }
}
