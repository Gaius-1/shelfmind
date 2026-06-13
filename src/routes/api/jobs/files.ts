import { createFileRoute } from '@tanstack/react-router'
import { auth } from '#/lib/auth.ts'
import { getUpload, getExport } from '#/lib/storage.ts'

const routeOptions: any = {
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        try {
          // 1. Authenticate user
          const session = await auth.api.getSession({ headers: request.headers })
          if (!session) {
            return new Response('Unauthorized', { status: 401 })
          }

          // 2. Extract query parameters
          const url = new URL(request.url)
          const bucket = url.searchParams.get('bucket')
          const key = decodeURIComponent(url.searchParams.get('key') || '')

          if (!bucket || !key) {
            return new Response('Missing parameters', { status: 400 })
          }

          // Key format: {orgId}/{jobId}/{fileName}
          const parts = key.split('/')
          if (parts.length < 3) {
            return new Response('Invalid key format', { status: 400 })
          }

          const orgId = parts[0]
          const jobId = parts[1]
          const fileName = parts.slice(2).join('/')

          // 3. Retrieve file
          let buffer: ArrayBuffer | null = null
          let contentType = 'application/octet-stream'

          if (bucket === 'PRODUCT_IMAGES') {
            buffer = await getUpload(orgId, jobId, fileName)
            const ext = fileName.split('.').pop()?.toLowerCase()
            if (ext === 'png') contentType = 'image/png'
            else if (ext === 'jpg' || ext === 'jpeg') contentType = 'image/jpeg'
            else if (ext === 'webp') contentType = 'image/webp'
          } else if (bucket === 'EXPORTS') {
            buffer = await getExport(orgId, jobId, fileName)
            contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          }

          if (!buffer) {
            return new Response('File not found', { status: 404 })
          }

          // 4. Return Response
          const headers: HeadersInit = {
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=31536000, immutable'
          }

          if (bucket === 'EXPORTS') {
            headers['Content-Disposition'] = `attachment; filename="${fileName}"`
          }

          return new Response(buffer, {
            status: 200,
            headers
          })

        } catch (err: any) {
          console.error('[API] Files route failed:', err)
          return new Response('Internal Server Error', { status: 500 })
        }
      }
    }
  }
}

export const Route = createFileRoute('/api/jobs/files')(routeOptions)
