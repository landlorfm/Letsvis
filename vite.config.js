// import { defineConfig } from 'vite'
// import vue from '@vitejs/plugin-vue'
// import { resolve } from 'path'
// import { viteSingleFile  } from 'vite-plugin-singlefile'

// export default defineConfig({
//   plugins: [vue(),viteSingleFile()],
//   resolve: {
//     alias: {
//       '@': resolve(__dirname, 'src')
//     }
//   },
//   build: {
//     outDir: 'dist',
//     cssCodeSplit: false,
//     assetsInlineLimit: 100000000,
//     rollupOptions: {
//       // input:{
//       // main: resolve(__dirname, 'index.html'),
//       // },
//       input: resolve(__dirname, 'letsvis-standalone.html'),
//       output: {
//         inlineDynamicImports: true,
//         entryFileNames: 'assets/[name].js',
//         // chunkFileNames: 'assets/[name].js',
//         assetFileNames: 'assets/[name].[ext]'
//       }
//     }
//   },
//   worker: {
//     format: 'es', // 确保 worker 也是 ES 模块
//     rollupOptions: {
//       output: {
//         inlineDynamicImports: true // worker 也内联
//       }
//     }
//   },

//     server: {
//     fs: {
//       allow: ['..'] // 允许访问项目根目录
//     },
//     host: '0.0.0.0', // 允许外部访问
//     port: 3000,
//     strictPort: true, // 如果端口被占用直接失败
//     cors: true, // 允许跨域
//   },

//   base: './'
// })

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
    },
    host: '0.0.0.0', // 允许外部访问
    port: 3000,
    strictPort: true, // 如果端口被占用直接失败
    cors: true, // 允许跨域
  }
});


