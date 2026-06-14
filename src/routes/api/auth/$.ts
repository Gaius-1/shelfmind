import { createFileRoute } from '@tanstack/react-router'


const routeOptions: any = {
    server: {
        handlers: {
            GET: async ({ request }: { request: Request }) => {
                const { auth } = await import('#/lib/auth.ts')
                return await auth.handler(request)
            },
            POST: async ({ request }: { request: Request }) => {
                const { auth } = await import('#/lib/auth.ts')
                return await auth.handler(request)
            },
        },
    },
}

export const Route = createFileRoute('/api/auth/$')(routeOptions)