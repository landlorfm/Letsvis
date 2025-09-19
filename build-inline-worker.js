import { rollup } from 'rollup';
import workerConfig from './rollup.config.js';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';

// 1. 确保 dist 存在
mkdirSync('dist', { recursive: true });

// 2.  Rollup 打包 worker → IIFE
const bundle = await rollup(workerConfig);
await bundle.write(workerConfig.output);
await bundle.close();

// 3. 读取 IIFE 代码并转义
const iifeCode = readFileSync('dist/worker.iife.js', 'utf-8');
const codeStr = JSON.stringify(iifeCode);

// 4. 替换 file-selector.vue 里的 new Worker(...)
const vueFile = 'src/ui/components/file-selector.vue';
let vueSrc = readFileSync(vueFile, 'utf-8');

// 只保留一条最稳妥的替换：把 ?worker 写法整体换掉
vueSrc = vueSrc.replace(
  /new Worker\(new URL\(['"]@\/workers\/parser\.worker\.js\?worker['"], import\.meta\.url\), \{[^}]*type:\s*['"]module['"][^}]*\}\)/,
  `new Worker(URL.createObjectURL(new Blob([${codeStr}], { type: 'application/javascript' })))`
);

writeFileSync(vueFile, vueSrc, 'utf-8');
console.log('✅ Worker 已内联到 file-selector.vue');