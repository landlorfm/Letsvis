// //示例使用流程
// import { extractValidSections } from './core/parser/log-preprocessor.js';
// import { LmemParser } from './core/parser/lmem-parser.js';
// import { TimestepParser } from './core/parser/timestep-parser.js';
// import { associateData } from './core/parser/log-associator.js';
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
//   new URL('../test/fixtures/20.log', import.meta.url),
//   'utf8'
// );
// const result = processRawLog(logText);

// // const resultAsc = associateData(result.lmemData, result.timestepData);
// // console.log(JSON.stringify(resultAsc, null, 2));


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

console.log('>>> main.js 正在执行');

createApp(App).use(router).mount('#app');



// import { createApp } from 'vue';
// import { createRouter, createWebHistory } from 'vue-router';
// import App from './App.vue';          // 引入 SFC
// import LmemView from '@/ui/views/lmem-view.vue';
// import TimestepView from '@/ui/views/timestep-view.vue';

// console.log('>>> main.js 正在执行');

// const routes = [
//   { path: '/', redirect: '/lmem' },
//   { path: '/lmem', component: LmemView },
//   { path: '/timestep', component: TimestepView },
// ];

// const router = createRouter({
//   history: createWebHistory(),
//   routes,
// });

// createApp(App).use(router).mount('#app');







// import { createApp } from 'vue';
// import { createRouter, createWebHistory } from 'vue-router';
// import LmemView from './ui/views/lmem-view.vue';
// //import TimestepView from './ui/views/timestep-view.vue';

// /* ---------- 路由 ---------- */
// const routes = [
//   { path: '/', redirect: '/lmem' },
//   { path: '/lmem', component: LmemView },
//   //{ path: '/timestep', component: TimestepView },
// ];

// const router = createRouter({
//   history: createWebHistory(),
//   routes,
// });

// /* ---------- 根组件 ---------- */
// const Root = {
//   template: `<router-view />`,
// };

// /* ---------- 挂载 ---------- */
// createApp(Root).use(router).mount('#app');
