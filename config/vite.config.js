import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';

export default defineConfig({
  plugins: [vue(),],
  
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      'shaders': resolve(__dirname, './src/assets/shaders')
    }
  },
  
  build: {
    assetsInlineLimit: 0, // 确保着色器文件不被内联
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        lmem: resolve(__dirname, 'src/ui/views/lmem-view.vue')
      }
    }
  },
  
  server: {
    fs: {
      allow: ['..'] // 允许访问项目根目录
    }
  }
});