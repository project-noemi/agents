import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Dev only: forward API calls to the Studio server. STUDIO_API_URL is the
    // server's origin (not a secret); the default assumes it runs locally.
    proxy: {
      '/api': process.env.STUDIO_API_URL ?? 'http://127.0.0.1:8787',
    },
  },
})
