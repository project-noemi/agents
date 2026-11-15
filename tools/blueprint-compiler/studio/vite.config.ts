/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Dev only: forward API calls to the Studio server. STUDIO_API_URL is the
    // server's origin (not a secret); the default assumes it runs locally.
    // NOEMI_STUDIO_TOKEN IS a secret: inject it with `infisical run` / `op run`.
    // The proxy (Node, not the browser) adds the bearer header, so the token is
    // never in the bundle or page JS. Never rename it with a VITE_ prefix: Vite
    // would then ship it to the browser.
    proxy: {
      '/api': {
        target: process.env.STUDIO_API_URL ?? 'http://127.0.0.1:8787',
        headers: process.env.NOEMI_STUDIO_TOKEN
          ? { authorization: `Bearer ${process.env.NOEMI_STUDIO_TOKEN}` }
          : {},
      },
    },
  },
  // Component tests: offline, in jsdom, no server and no keys.
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
})
