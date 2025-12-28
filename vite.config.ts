import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'fs'

// Read version from package.json
const packageJson = JSON.parse(readFileSync('./package.json', 'utf-8'))

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: process.env.GITHUB_PAGES ? '/riley_task_app/' : '/',
  server: {
    port: 5181,
    host: true, // Expose server to network
  },
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(packageJson.version),
  },
  test: {
    globals: true,
    environment: 'node',
    setupFiles: './src/test/setup.ts',
  },
})
