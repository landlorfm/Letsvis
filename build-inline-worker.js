import { rollup } from 'rollup';
import workerConfig from './rollup.config.js';
import { readFileSync, writeFileSync } from 'fs';

const bundle = await rollup(workerConfig);
await bundle.write(workerConfig.output);
await bundle.close();

// 读取已完全自包含的 IIFE
const iifeCode = readFileSync('dist/worker.iife.js', 'utf-8');
const codeStr  = JSON.stringify(iifeCode);

// 替换组件
const vueFile = 'src/ui/components/file-selector.vue';
let vueSrc = readFileSync(vueFile, 'utf-8');
vueSrc = vueSrc.replace(
  /new Worker\(new URL\(['"]@\/workers\/parser\.worker\.js\?worker['"], import\.meta\.url\), \{[^}]*\}\)/,
  `new Worker(URL.createObjectURL(new Blob([${codeStr}], { type: 'application/javascript' })))`
);
vueSrc = vueSrc.replace(
  /new Worker\(URL\.createObjectURL\(new Blob\(\[[\s\S]*?\],\s*\{ type: 'application\/javascript' \}\)\)\)/,
  `new Worker(URL.createObjectURL(new Blob([${codeStr}], { type: 'application/javascript' })))`
);

writeFileSync(vueFile, vueSrc, 'utf-8');
console.log('✅ Worker 已完全内联，无外部变量');