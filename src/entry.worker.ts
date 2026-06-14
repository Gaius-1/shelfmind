// In-memory log buffer to capture logs on the edge worker
const logBuffer: string[] = []

const formatArg = (arg: any): string => {
  if (arg instanceof Error) {
    return `${arg.message}\n${arg.stack}`
  }
  if (typeof arg === 'object' && arg !== null) {
    try {
      return JSON.stringify(arg)
    } catch {
      return String(arg)
    }
  }
  return String(arg)
}

const captureLog = (type: string, ...args: any[]) => {
  const time = new Date().toISOString()
  const msg = args.map(formatArg).join(' ')
  logBuffer.push(`[${time}] [${type}] ${msg}`)
  if (logBuffer.length > 500) {
    logBuffer.shift()
  }
}

// Override console methods to capture logs (must run before server-entry is loaded)
const originalLog = console.log
const originalError = console.error
const originalWarn = console.warn

console.log = (...args: any[]) => {
  captureLog('LOG', ...args)
  originalLog(...args)
}
console.error = (...args: any[]) => {
  captureLog('ERROR', ...args)
  originalError(...args)
}
console.warn = (...args: any[]) => {
  captureLog('WARN', ...args)
  originalWarn(...args)
}

// Catch global worker errors
globalThis.addEventListener('error', (event: any) => {
  captureLog('GLOBAL_ERROR', event.error || event.message)
})
globalThis.addEventListener('unhandledrejection', (event: any) => {
  captureLog('GLOBAL_REJECTION', event.reason)
})

export { JobCoordinator } from './workers/jobCoordinator'

let handlerPromise: Promise<any> | null = null
function getHandler() {
  if (!handlerPromise) {
    handlerPromise = import('@tanstack/react-start/server-entry').then(m => m.default)
  }
  return handlerPromise
}

export default {
  fetch: async (request: any, env: any, ctx: any) => {
    try {
      const url = new URL(request.url);

      
      if (url.pathname === '/debug-logs') {
        return new Response(JSON.stringify({ version: "v3-dynamic-imports", logs: logBuffer }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }

      if (url.pathname === '/debug-env') {
        return new Response(JSON.stringify({
          envKeys: Object.keys(env || {}),
          hasDB: !!env.DB,
          hasSecret: !!env.BETTER_AUTH_SECRET,
          hasAuthUrl: !!env.BETTER_AUTH_URL,
          hasGoogleId: !!env.GOOGLE_CLIENT_ID,
          hasGoogleSecret: !!env.GOOGLE_CLIENT_SECRET,
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Inject ALL bindings into globalThis and process.env so db/index.ts and auth.ts can find them
      if (!globalThis.process) (globalThis as any).process = {};
      if (!globalThis.process.env) (globalThis as any).process.env = {};
      
      for (const key of Reflect.ownKeys(env)) {
        (globalThis as any)[key] = env[key];
        (globalThis.process.env as any)[key] = env[key];
      }
      const handler = await getHandler();
      return await handler.fetch(request, env, ctx);
      
    } catch (err: any) {
      captureLog('CRITICAL_FETCH_ERROR', err)
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

