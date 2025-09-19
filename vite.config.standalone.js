import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { viteSingleFile } from 'vite-plugin-singlefile'
import string from '@bkuri/rollup-plugin-string'   
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [
    vue(),
    viteSingleFile({ removeViteModuleLoader: true }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  build: {
    outDir: 'dist',
    assetsInlineLimit: Infinity,
    rollupOptions: {
      input: { main: 'letsvis-standalone.html', },
      plugins: [
        string({ include: '**/*.worker.js' })
      ]
    }
  },
  worker: { format: 'es' }
})