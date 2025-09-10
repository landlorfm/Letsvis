// import { defineConfig } from 'rollup';
// import { nodeResolve } from '@rollup/plugin-node-resolve';
// import inline from 'rollup-plugin-inline-code';

// export default defineConfig({
//   input: 'src/main.js',
//   output: {
//     file: 'build/letsvis-standalone.html',
//     format: 'iife',
//     inlineDynamicImports: true,
//   },
//   plugins: [
//     nodeResolve(),
//     inline({
//       include: ['**/*.worker.js', '**/*.glsl'],
//       transform: (code) => `export default '${code.replace(/'/g, "\\'")}'`
//     })
//   ]
// });

import resolve from '@rollup/plugin-node-resolve';
import inlineDeps from 'rollup-plugin-inline-deps';

export default {
  input: 'src/workers/parser.worker.js',
  output: {
    file: 'dist/worker.iife.js',
    format: 'iife',
    name: 'WorkerGlobal'   // 仅作内部命名空间，无实际外部引用
  },
  plugins: [
    resolve(),
    inlineDeps({ warn: true }) // 关键：把 import 全部展开到同一文件
  ]
};