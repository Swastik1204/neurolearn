import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: process.env.PORT || 5173,
    strictPort: false,
    hmr: {
      port: process.env.HMR_PORT || undefined,
    },
    watch: {
      usePolling: true,
    },
  },
})
