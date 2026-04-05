import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    // Use polling in dev so edits are always detected
    // even when native filesystem events are occasionally missed.
    watch: {
      usePolling: true,
      interval: 120,
    },
    // Disable browser cache in dev to make refresh always fetch latest code.
    headers: {
      'Cache-Control': 'no-store',
      Pragma: 'no-cache',
      Expires: '0',
    },
  },
})
