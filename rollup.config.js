import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import alias from '@rollup/plugin-alias'; 
import { fileURLToPath } from 'url';
const __dirname = fileURLToPath(new URL('.', import.meta.url));

export default {
  input: 'src/workers/parser.worker.js',
  external: [],
  output: {
    file: 'dist/worker.iife.js',
    format: 'iife',
    name: 'WorkerGlobal',
    inlineDynamicImports: true,
  },
  plugins: [
    alias({                         // ① 关键：告诉 Rollup @ 指向哪里
      entries: [
        { find: '@', replacement: `${__dirname}/src` }
      ]
    }),
    resolve({ browser: true, preferBuiltins: false }),
    commonjs({ transformMixedEsModules: true })
  ]
};