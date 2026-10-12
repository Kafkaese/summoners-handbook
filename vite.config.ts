import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: { host: true },
  // The bundled creature data is ~700 kB; fine for a local app.
  build: { chunkSizeWarningLimit: 1000 },
})
