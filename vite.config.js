import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.js',
    // Scope to this app's own tests — the repo also vendors ~40 external
    // skill/agent sources under .claude/ that ship their own unrelated
    // test files (Node's node:test runner, differing suite shapes).
    include: ['src/**/*.test.{js,jsx}'],
  },
})
