import { getBinding } from './cloudflare.ts'

function getQueueBinding() {
  return getBinding('IMAGE_QUEUE')
}

export interface QueueMessage {
  jobId: string
  orgId: string
  imageKeys: string[]
}

/**
 * Dispatches a job to the extraction queue.
 * Falls back to local asynchronous execution in development.
 */
export async function dispatchJob(
  jobId: string,
  orgId: string,
  imageKeys: string[]
): Promise<void> {
  const binding = getQueueBinding()

  if (binding) {
    console.log(`[Queue] Sending job ${jobId} to Cloudflare Queue`)
    await binding.send({ jobId, orgId, imageKeys })
    return
  }

  // Local fallback: execute asynchronously in the background using setTimeout
  console.log(`[Queue] Local dev fallback: processing job ${jobId} asynchronously`)
  
  // Dynamic import to avoid circular dependency
  setTimeout(async () => {
    try {
      const { processJob } = await import('./pipeline.ts')
      const env = (process.env as any).JOB_COORDINATOR ? process.env : globalThis
      await processJob(jobId, orgId, imageKeys, env)
    } catch (error) {
      console.error(`[Queue] Error running job ${jobId} in background:`, error)
    }
  }, 0)
}
