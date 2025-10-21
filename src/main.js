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



