import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  test: {
    environment: 'node',
    // Two locations by design: tests/ for the suites added since, and lib/ for
    // pricing.test.ts, which already lived beside its source.
    include: ['tests/**/*.test.ts', 'lib/**/*.test.ts'],
    // pricing.test.ts calls describe/test/expect without importing them, so
    // globals stay enabled rather than rewriting a test file that already works.
    globals: true,
    // Tests that read the live database assert on row counts, so they must not
    // interleave with each other.
    fileParallelism: false,
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./', import.meta.url)),
    },
  },
})
