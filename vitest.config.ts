import { defineConfig } from 'vitest/config'

// Root tests only: the API surface check over the built packages. Each package runs its own
// tests with `vitest run` in its directory.
export default defineConfig({
  test: { include: ['test/**/*.test.ts'] },
})
