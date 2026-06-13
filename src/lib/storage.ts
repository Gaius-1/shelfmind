import { join } from 'path'
import { existsSync } from 'fs'

const MOCK_DIR = join(process.cwd(), '.wrangler', 'mock-r2')

function getR2Binding(bucketName: 'PRODUCT_IMAGES' | 'EXPORTS') {
  return (process.env as any)[bucketName] || (globalThis as any)[bucketName]
}

/**
 * Saves an uploaded product image.
 */
export async function saveUpload(
  orgId: string,
  jobId: string,
  fileName: string,
  buffer: ArrayBuffer | Buffer
): Promise<string> {
  const key = `uploads/${orgId}/${jobId}/${fileName}`
  const binding = getR2Binding('PRODUCT_IMAGES')

  if (binding) {
    await binding.put(key, buffer)
    return key
  }

  // Local fallback using Bun
  const filePath = join(MOCK_DIR, key)
  await Bun.write(filePath, buffer)
  return key
}

/**
 * Retrieves an uploaded product image.
 */
export async function getUpload(
  orgId: string,
  jobId: string,
  fileName: string
): Promise<ArrayBuffer | null> {
  const key = `uploads/${orgId}/${jobId}/${fileName}`
  const binding = getR2Binding('PRODUCT_IMAGES')

  if (binding) {
    const obj = await binding.get(key)
    if (!obj) return null
    return await obj.arrayBuffer()
  }

  // Local fallback
  const filePath = join(MOCK_DIR, key)
  if (!existsSync(filePath)) return null
  const file = Bun.file(filePath)
  return await file.arrayBuffer()
}

/**
 * Saves a generated export file.
 */
export async function saveExport(
  orgId: string,
  jobId: string,
  fileName: string,
  buffer: ArrayBuffer | Buffer
): Promise<string> {
  const key = `exports/${orgId}/${jobId}/${fileName}`
  const binding = getR2Binding('EXPORTS')

  if (binding) {
    await binding.put(key, buffer)
    return key
  }

  // Local fallback
  const filePath = join(MOCK_DIR, key)
  await Bun.write(filePath, buffer)
  return key
}

/**
 * Retrieves a generated export file.
 */
export async function getExport(
  orgId: string,
  jobId: string,
  fileName: string
): Promise<ArrayBuffer | null> {
  const key = `exports/${orgId}/${jobId}/${fileName}`
  const binding = getR2Binding('EXPORTS')

  if (binding) {
    const obj = await binding.get(key)
    if (!obj) return null
    return await obj.arrayBuffer()
  }

  // Local fallback
  const filePath = join(MOCK_DIR, key)
  if (!existsSync(filePath)) return null
  const file = Bun.file(filePath)
  return await file.arrayBuffer()
}

/**
 * Returns a URL path to retrieve the file from either R2 or local mock.
 * This route is handled by `api/files` or similar.
 */
export function getFileUrl(bucket: 'PRODUCT_IMAGES' | 'EXPORTS', key: string): string {
  // Use a unified routing path that handles both dev and prod
  const cleanKey = key.replace(/^(uploads\/|exports\/)/, '')
  return `/api/jobs/files?bucket=${bucket}&key=${encodeURIComponent(cleanKey)}`
}
