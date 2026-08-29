import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  // Vite 8 resolves tsconfig `paths` natively; no plugin needed.
  resolve: { tsconfigPaths: true },
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['tests/unit/**/*.test.ts', 'tests/unit/**/*.test.tsx', 'tests/int/**/*.int.spec.ts'],
    // Integration specs boot Payload against one shared database; running them in
    // parallel would have them clobber each other's fixtures.
    fileParallelism: false,
  },
})
