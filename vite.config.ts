import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig({
  server: {
    port: 5173,
    host: true,
    allowedHosts: [
      'lernbibliothek.benschi.net',
    ],
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
      },
    },
  },
  plugins: [
    vue(),
    vueDevTools(),
    // Handle .md files as raw text imports
    {
      name: 'markdown-raw',
      transform(code, id) {
        if (id.endsWith('.md')) {
          return { code: `export default ${JSON.stringify(code)}`, map: null }
        }
      },
    },
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
