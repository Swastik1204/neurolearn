import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: [
      { find: '@', replacement: path.resolve(__dirname, './src') },
    ],
  },
  optimizeDeps: {
    include: ['long', 'seedrandom'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('firebase')) return 'firebase';
            if (id.includes('@google/generative-ai')) return 'gemini';
            if (id.includes('recharts')) return 'charts';
            if (id.includes('jspdf') || id.includes('html2canvas')) return 'pdf';
            if (id.includes('@tensorflow')) return 'tensorflow';
          }
        }
      }
    },
    chunkSizeWarningLimit: 600
  }
})