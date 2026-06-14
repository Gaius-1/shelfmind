import { createFileRoute } from '@tanstack/react-router'
import { getBinding } from '#/lib/cloudflare.ts'

const routeOptions: any = {
  server: {
    handlers: {
      GET: async ({ request, params }: { request: Request, params: any }) => {
        const { jobId } = params
        
        const coordinatorBinding = getBinding('JOB_COORDINATOR')

        if (!coordinatorBinding) {
          console.error('[API] JOB_COORDINATOR binding not found')
          return new Response("JOB_COORDINATOR binding not found", { status: 500 })
        }

        try {
          const id = coordinatorBinding.idFromName(jobId)
          const stub = coordinatorBinding.get(id)
          
          // Forward the WebSocket Upgrade request (or standard GET) to the DO
          return await stub.fetch(request)
        } catch (err) {
          console.error('[API] Failed to forward to JOB_COORDINATOR', err)
          return new Response("Internal Server Error", { status: 500 })
        }
      }
    }
  }
}

export const Route = createFileRoute('/api/jobs/$jobId/stream')(routeOptions)
