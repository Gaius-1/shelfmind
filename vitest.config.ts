import { defineConfig } from 'vitest/config'

// Dedicated Vitest config. The main vite.config.ts loads the Cloudflare plugin,
// which is incompatible with Vitest's environment handling, so unit tests run
// against a plain Node environment here instead.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
