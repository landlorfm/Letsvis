# LetsVis 可视化工具DEMO

基于浏览器端的日志可视化分析工具, 当前使用说明可见：https://wiki.sophgo.com/pages/viewpage.action?pageId=191312836

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
├── dist/                         # 构建输出目录
│   └── letsvis-standalone.html   # 自包含HTML入口
│
├── src/
│   ├── core/
│   │   ├── parser/               # 【保留】日志解析核心逻辑
│   │   │   │
│   │   │   └── dep-collector.js   # ts 依赖关系构建
│   │   │
│   │   ├── diff/ (TODO)               # 【保留】对比引擎
│   │   │   ├── diff-engine.js         # 核心差异算法
│   │   │   └── conflict-detector.js   # Bank冲突检测
│   │   │
│   │   └── visualization/        # 可视化核心
│   │       ├── echarts-manager.js     # ECharts实例统一管理器
│   │       │  
│   │       ├── lanes/     # 泳道多态实现
│   │       │     ├── base-lane.js        # 泳道基类
│   │       │     ├── gdma-lane.js        # GDMA 泳道实现
│   │       │     ├── layer-lane.js       # Layer泳道实现
│   │       │     ├── profile-lane.js     # Profile泳道实现
│   │       │     └── lane-factory.js     # 泳道工厂
│   │       │
│   │       ├── table/     # 表格
│   │       │   ├── useProfileTableData.js    # profile表格筛选逻辑
│   │       │   └── useTableData.js           # timestep表格筛选逻辑
│   │       │  
│   │       └── option-generators/     # 各图表option生成器
│   │           ├── lmem-option.js     # LMEM option生成
│   │           ├── timestep-option.js # 时间轴option生成
│   │           ├── profile-option.js  # profile option生成
│   │           └── summary-option.js  # 统计图表option生成
│   │
│   │
│   ├── ui/
│   │   ├── components/
│   │   │   ├── charts/                # ★新增: ECharts图表组件
│   │   │   │   ├── base-chart.vue          # 基础图表组件
│   │   │   │   ├── lmem-chart.vue  # LMEM组件
│   │   │   │   ├── timestep-chart.vue      # 时间轴图表组件
│   │   │   │   ├── profile-chart.vue      # profile图表组件
│   │   │   │   └── memory-summary-chart.vue # 内存统计组件
│   │   │   │
│   │   │   ├── data-table/           # ★新增: 表格组件
│   │   │   │   ├── data-table.vue            # 纯展示表格
│   │   │   │   ├── profile-table-filter.vue  # profile 筛选面板
│   │   │   │   └── table-filter.vue          # 时间步筛选面板
│   │   │   │
│   │   │   ├── file-selector.vue      # 【保留】文件选择器
│   │   │   ├── lmem-spec-panel.vue    # 【保留】规格面板控制器
│   │   │   └── comparison-slider.vue  # 【调整】对比控制条(适配ECharts)
│   │   │
│   │   └── views/                     # 主视图
│   │       ├── lmem-view.vue          # 【重构】LMEM可视化页
│   │       ├── timestep-view.vue      # 【重构】Timestep可视化页
│   │       └── profile-view.vue       # 【新增】Profile可视化页
│   │
│   ├── workers/                  # 【弃用】Web Worker脚本
│   │
│   ├── router/                   # 【保留】路由
│   │   └── index.js    
│   │
│   ├── assets/
│   │   └── styles/               # 【调整】样式
│   │       ├── themes/
│   │       │   └── 
│   │       └── base.css          # 【调整】基础样式
│   │
│   └── utils/                    # 【保留】工具函数
│       ├── shared-state.js       # 【新增】页面共享数据处理
│       └── color-utils.js        # 颜色编码(可能调整)
│
├── test/                         # 【需要更新】测试
│   ├── unit/
│   │   ├── parser.test.js        # 【保留】解析器测试
│   │   ├── diff.test.js          # 【保留】对比测试
│   │   └── visualization.test.js # ★新增: 可视化option生成器测试
│   │
│   └── fixtures/                 # 【保留】测试用例
│
├── config/                       # 【调整】构建配置
├── package.json                  # 【调整】依赖更新(加入echarts)
└── index.html                    # 【保留】开发入口


```

## 注意事项

-   本项目使用 ES 模块 (`"type": "module"`)。
-   开发时修改代码会自动热重载。
-   如果遇到依赖安装问题，可尝试删除 `node_modules` 和 `package-lock.json` 后重新安装。
