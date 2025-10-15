// //示例使用流程
// import { extractValidSections } from './core/parser/log-preprocessor.js';
// import { LmemParser } from './core/parser/lmem-parser.js';
// import { TimestepParser } from './core/parser/timestep-parser.js';
// import { MemoryStatistics } from './core/parser/memory-statistics.js';
// import { readFileSync, writeFileSync } from 'fs';

// function processRawLog(rawLog) {
//   // 第一阶段：提取有效内容
//   const { lmemSections, timestepSections } = extractValidSections(rawLog);
  
//   // 第二阶段：详细解析
//   const lmemParser = new LmemParser();
//   const timestepParser = new TimestepParser();
  
//   const lmemData = lmemParser.parse(lmemSections);
//   const timestepData = timestepParser.parse(timestepSections);

//   return {
//     lmemData,
//     timestepData
//   };
  
// }

// // 使用示例

// const logText = readFileSync(
//   new URL('../test/fixtures/test01.log', import.meta.url),
//   'utf8'
// );
// const result = processRawLog(logText);



// /* 保存解析结果 */
// writeFileSync(
//   new URL('../output/lmem.json', import.meta.url),
//   JSON.stringify(result.lmemData, null, 2),
//   'utf8'
// );

// writeFileSync(
//   new URL('../output/timestep.json', import.meta.url),
//   JSON.stringify(result.timestepData, null, 2),
//   'utf8'
// );


// const memoryStats = new MemoryStatistics();
// memoryStats.setLmemData(result.lmemData);
// memoryStats.calculateAllStatistics();
// const resultAsc = memoryStats.getStatistics();


// writeFileSync(
//   new URL('../output/enhanced.json', import.meta.url),
//   JSON.stringify(resultAsc, null, 2),
//   'utf8'
// );


import { createApp } from 'vue';
import App from './App.vue';          // 引入 SFC
import router from './router';        // 导入路由配置

import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'

console.log('>>> main.js 正在执行');

const app = createApp(App);
app.use(router);
app.use(ElementPlus);
app.mount('#app');



