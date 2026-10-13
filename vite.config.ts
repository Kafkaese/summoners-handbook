import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // GitHub Pages serves the site from /summoners-handbook/; the deploy workflow
  // passes the path in. Locally the app is served from the root.
  base: process.env.BASE_PATH ?? '/',
  server: { host: true },
  // The bundled summon creature data is ~1 MB (about 250 kB gzipped).
  build: { chunkSizeWarningLimit: 1500 },
})
