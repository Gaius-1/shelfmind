import handler from '@tanstack/react-start/server-entry'
export { JobCoordinator } from './workers/jobCoordinator'

export default {
  fetch: async (request: any, env: any, ctx: any) => {
    try {
      // Inject ALL bindings into globalThis and process.env so db/index.ts and auth.ts can find them
      if (!globalThis.process) (globalThis as any).process = {};
      if (!globalThis.process.env) (globalThis as any).process.env = {};
      
      for (const key of Reflect.ownKeys(env)) {
        (globalThis as any)[key] = env[key];
        (globalThis.process.env as any)[key] = env[key];
      }
      
      return await handler.fetch(request, env, ctx);
      
    } catch (err: any) {
      return new Response(err.stack || err.message || String(err), { status: 500 });
    }
  },
  async queue(batch: any, env: any, ctx: any) {
    if (!globalThis.process) (globalThis as any).process = {};
    if (!globalThis.process.env) (globalThis as any).process.env = {};
    
    for (const key of Reflect.ownKeys(env)) {
      (globalThis as any)[key] = env[key];
      (globalThis.process.env as any)[key] = env[key];
    }
    console.log(`Received ${batch.messages.length} messages in queue`);
    // TODO: Implement image processing pipeline here
  }
}
