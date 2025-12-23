import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
// Removed @tailwindcss/vite plugin - using PostCSS instead

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // tailwindcss(), // Removed - using PostCSS config instead
  ],
  define: {
    global: 'globalThis',
  },
  resolve: {
    alias: {
      buffer: 'buffer',
    },
  },
  optimizeDeps: {
    include: ['buffer'],
  },
})
