// @ts-nocheck
// Types for `server.handlers` are injected by the TanStack Start Vite plugin at runtime.
// Running `bun run dev` regenerates routeTree.gen.ts and resolves IDE type errors.
import { auth } from '#/lib/auth.ts'
import { createFileRoute } from '@tanstack/react-router'


const routeOptions: any = {
    server: {
        handlers: {
            GET: async ({ request }: { request: Request }) => {
                return await auth.handler(request)
            },
            POST: async ({ request }: { request: Request }) => {
                return await auth.handler(request)
            },
        },
    },
}

export const Route = createFileRoute('/api/auth/$')(routeOptions)