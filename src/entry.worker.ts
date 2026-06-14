import handler from '@tanstack/react-start/server-entry'
export { JobCoordinator } from './workers/jobCoordinator'

export default {
  fetch: (request: any, env: any, ctx: any) => {
    // Inject bindings into globalThis and process.env so db/index.ts and auth.ts can find them
    Object.assign(globalThis, env);
    if (globalThis.process) Object.assign(globalThis.process.env, env);
    
    return handler.fetch(request, env, ctx);
  },
  async queue(batch: any, env: any, ctx: any) {
    Object.assign(globalThis, env);
    if (globalThis.process) Object.assign(globalThis.process.env, env);

    console.log(`Received ${batch.messages.length} messages in queue`);
    // TODO: Implement image processing pipeline here
  }
}
