export function getBinding(name: string): any {
  return (globalThis as any)[name] || (process.env as any)[name]
}


