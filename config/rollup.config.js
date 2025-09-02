import { defineConfig } from 'rollup';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import inline from 'rollup-plugin-inline-code';

export default defineConfig({
  input: 'src/main.js',
  output: {
    file: 'build/letsvis-standalone.html',
    format: 'iife',
    inlineDynamicImports: true,
  },
  plugins: [
    nodeResolve(),
    inline({
      include: ['**/*.worker.js', '**/*.glsl'],
      transform: (code) => `export default '${code.replace(/'/g, "\\'")}'`
    })
  ]
});