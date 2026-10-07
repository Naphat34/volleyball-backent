import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite' 

// https://vitejs.dev/config/
export default defineConfig({
  resolve: {
    alias: {
      'react-router-dom': fileURLToPath(new URL('./src/router.jsx', import.meta.url)),
    },
  },
  plugins: [
    react(),
    tailwindcss(), 
  ],
  build: {
    chunkSizeWarningLimit: 2500,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;

          if (/\/node_modules\/(react|react-dom|scheduler)\//.test(id)) {
            return 'vendor-react';
          }

          if (id.includes('pdf-lib') || id.includes('@pdf-lib') || id.includes('@react-pdf') || id.includes('jspdf')) {
            return 'vendor-pdf';
          }

          if (id.includes('lucide-react')) {
            return 'vendor-icons';
          }

          if (id.includes('socket.io-client') || id.includes('engine.io-client')) {
            return 'vendor-socket';
          }

          if (id.includes('axios') || id.includes('sweetalert2') || id.includes('jwt-decode')) {
            return 'vendor-utils';
          }

          return undefined;
        },
      },
    },
  },
})
