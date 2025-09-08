# LetsVis 可视化工具DEMO

基于浏览器端的日志可视化分析工具, 当前使用说明可见：

## 开发环境要求

- Node.js
- npm 

## 快速开始

1.  **克隆项目**
    ```bash
    git clone  https://github.com/landlorfm/Letsvis
    cd letsvis
    ```

2.  **安装依赖**
    ```bash
    npm install
    ```

3.  **启动开发服务器**
    ```bash
    npm run dev
    ```
    在浏览器打开 `http://localhost:3000`。



## 项目结构
```markdown
letsvis/
├── dist/                    # 构建输出目录（最终产物）
│   └── letsvis-standalone.html  # 自包含HTML入口
│
├── src/
│   ├── core/                 # 核心逻辑
│   │   ├── parser/           # 日志解析
│   │   │   ├── lmem-parser.js    # LMEM解析器
│   │   │   ├── timestep-parser.js # Timestep解析器
│   │   │   ├── log-associator.js # 关联两种解析并计算时序内存统计(弃用)
│   │   │   ├── memory-statistics.js # 内存信息统计
│   │   │   └── log-preprocessor.js  # 日志预处理提取有效信息
│   │   │
│   │   ├── diff/             # 对比引擎(TODO)
│   │   │   ├── diff-engine.js    # 核心差异算法
│   │   │   └── conflict-detector.js # Bank冲突检测
│   │   │
│   │   └── visualization/    # 可视化核心
│   │       ├── renderers/          # 拆分不同渲染器
│   │       │   ├── lmem-renderer.js # LMEM渲染
│   │       │   ├── memory-summary.js   # 时序内存统计计算渲染
│   │       │   ├── timeline-renderer.js # Timestep渲染
│   │       │   └── canvas2d-render.js # 可复用的坐标轴绘制逻辑
│   │       ├── controls/           # 交互控制
│   │       │   ├── zoom-handler.js
│   │       │   └── selection-manager.js
│   │       └── shader-loader.js   # 着色器统一管理
│   │
│   ├── ui/                   # 用户界面
│   │   ├── components/       # 可复用组件
│   │   │   ├── file-selector.vue    # 文件选择器
│   │   │   ├── lmem-spec-panel.vue    # 规格面板统一控制器
│   │   │   └── comparison-slider.vue # 对比控制条
│   │   │
│   │   └── views/            # 主视图
│   │       ├── lmem-view.vue      # LMEM可视化页，同时包含时间步内存总览统计图
│   │       └── timestep-view.vue  # Timestep可视化页
│   │
│   ├── workers/              # Web Worker脚本
│   │   ├── parser.worker.js  # 解析Worker
│   │   └── diff.worker.js    # 对比Worker
│   │
│   ├── router/              # 路由
│   │   └── index.js    
│   │
│   │
│   ├── assets/               # 静态资源
│   │   ├── shaders/          # WebGL着色器
│   │   │   ├── memory.vert    # 主渲染顶点着色器            
│   │   │   ├── memory.frag    # 主渲染片元着色器
│   │   │   ├── grid.vert      # 网格顶点着色器
│   │   │   ├── grid.frag      # 网格片元着色器
│   │   │   ├── tooltip.vert   # 工具提示顶点着色器
│   │   │   ├── tooltip.frag   # 工具提示片元着色器
│   │   │   ├── summary.vert   # 统计视图顶点着色器
│   │   │   └── summary.frag   # 统计视图片元着色器
│   │   │
│   │   └── styles/           # 样式
│   │       ├── themes/       # 主题
│   │       └── base.css      # 基础样式
│   │
│   └── utils/                    # 工具函数
│       ├── coordinate-utils.js     # 坐标转换处理
│       ├── file-utils.js           # 文件处理
│       └── color-utils.js          # 颜色编码
│
├── test/
│   ├── unit/                 # 单元测试
│   │   ├── parser.test.js    # 解析器测试
│   │   └── diff.test.js      # 对比测试
│   │
│   └── fixtures/             # 测试用例
│       ├── sample1.log       # 样例日志1
│       └── sample2.log       # 样例日志2
│
├── config/                   # 构建配置
│   └── rollup.config.js      # Rollup打包配置
│
├── index.html 
│
└── vite.config.js      # 资源内联配置  


```

## 注意事项

-   本项目使用 ES 模块 (`"type": "module"`)。
-   开发时修改代码会自动热重载。
-   如果遇到依赖安装问题，可尝试删除 `node_modules` 和 `package-lock.json` 后重新安装。