import { defineConfig } from 'vitest/config'

export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2023',
    chunkSizeWarningLimit: 4096,
  },
  test: {
    include: ['test/**/*.test.ts'],
  },
})
