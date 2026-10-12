import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // GitHub Pages serves the site from /summoners-handbook/; the deploy workflow
  // passes the path in. Locally the app is served from the root.
  base: process.env.BASE_PATH ?? '/',
  server: { host: true },
  // The bundled creature data is ~700 kB; fine for a local app.
  build: { chunkSizeWarningLimit: 1000 },
})
