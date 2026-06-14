export function getBinding(name: string): any {
  const val = (globalThis as any)[name] || (process.env as any)[name]
  if (typeof val === 'string' && val.startsWith('\ufeff')) {
    return val.slice(1)
  }
  return val
}


