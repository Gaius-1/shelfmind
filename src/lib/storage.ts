import { join, dirname } from 'path'
import { existsSync } from 'fs'
import { mkdir, writeFile, readFile } from 'fs/promises'
import { getBinding } from './cloudflare.ts'

const MOCK_DIR = join(process.cwd(), '.wrangler', 'mock-r2')

function getR2Binding(bucketName: 'PRODUCT_IMAGES' | 'EXPORTS') {
  return getBinding(bucketName)
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

  // Local fallback using Node fs/promises
  const filePath = join(MOCK_DIR, key)
  await mkdir(dirname(filePath), { recursive: true })
  await writeFile(filePath, Buffer.from(buffer as any))
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

  // Local fallback using Node fs/promises
  const filePath = join(MOCK_DIR, key)
  if (!existsSync(filePath)) return null
  const buf = await readFile(filePath)
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
}

/**
 * Lists all uploaded product image keys for a job.
 */
export async function listUploads(orgId: string, jobId: string): Promise<string[]> {
  const prefix = `uploads/${orgId}/${jobId}/`
  const binding = getR2Binding('PRODUCT_IMAGES')

  if (binding) {
    const listed = await binding.list({ prefix })
    return listed.objects.map((o: any) => o.key)
  }

  // Local fallback
  const { readdir } = await import('fs/promises')
  const dirPath = join(MOCK_DIR, 'uploads', orgId, jobId)
  if (!existsSync(dirPath)) return []
  const files = await readdir(dirPath)
  return files.map(f => `uploads/${orgId}/${jobId}/${f}`)
}

/**
 * Deletes all uploaded product image keys for a job (Garbage Collection).
 */
export async function deleteUploads(orgId: string, jobId: string): Promise<void> {
  const keys = await listUploads(orgId, jobId)
  if (keys.length === 0) return

  const binding = getR2Binding('PRODUCT_IMAGES')
  if (binding) {
    await binding.delete(keys)
    return
  }

  // Local fallback
  const { unlink } = await import('fs/promises')
  for (const key of keys) {
    const filePath = join(MOCK_DIR, key)
    if (existsSync(filePath)) {
      await unlink(filePath)
    }
  }
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

  // Local fallback using Node fs/promises
  const filePath = join(MOCK_DIR, key)
  await mkdir(dirname(filePath), { recursive: true })
  await writeFile(filePath, Buffer.from(buffer as any))
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

  // Local fallback using Node fs/promises
  const filePath = join(MOCK_DIR, key)
  if (!existsSync(filePath)) return null
  const buf = await readFile(filePath)
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
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
