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
│   │   ├── parser/               # 日志解析核心逻辑
│   │   │   ├── log_parser.py         # 原始日志解析文件
│   │   │   └── dep-collector.js   # ts 依赖关系构建
│   │   │
│   │   │
│   │   └── visualization/        # 可视化核心
│   │       ├── echarts-manager.js     # ECharts实例统一管理器（交互性能原因未开启）
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
│   │   │   ├── charts/                # ECharts图表组件
│   │   │   │   ├── base-chart.vue          # 基础图表组件
│   │   │   │   ├── lmem-chart.vue          # LMEM组件
│   │   │   │   ├── timestep-chart.vue      # 时间轴图表组件
│   │   │   │   ├── profile-chart.vue       # profile图表组件
│   │   │   │   └── memory-summary-chart.vue # 内存统计组件
│   │   │   │
│   │   │   ├── data-table/           # 表格组件
│   │   │   │   ├── data-table.vue            # 纯展示表格
│   │   │   │   ├── profile-table-filter.vue  # profile 筛选面板
│   │   │   │   └── table-filter.vue          # 时间步筛选面板
│   │   │   │
│   │   │   ├── file-selector.vue      # 文件选择器
│   │   │   ├── lmem-spec-panel.vue    # 规格面板控制器
│   │   │   └── comparison-slider.vue  # 对比控制条(适配ECharts)【TODO】
│   │   │
│   │   └── views/                     # 主视图
│   │       ├── lmem-view.vue          # LMEM可视化页
│   │       ├── timestep-view.vue      # Timestep可视化页
│   │       └── profile-view.vue       # Profile可视化页
│   │
│   │
│   ├── router/                   # 路由
│   │   └── index.js    
│   │
│   ├── assets/
│   │   └── styles/               # 样式
│   │       ├── themes/
│   │       │   └── 
│   │       └── base.css          # 基础样式
│   │
│   └── utils/                    # 工具函数
│       └── shared-state.js       # 页面共享数据处理
│
├── test/                         # 测试【TODO】
│   ├── unit/(TODO)
│   │
│   └── fixtures/                 # 测试用例
│
├── package.json                  # 依赖
│
├── vite.config.js                # vite 开发配置脚本
├── vite.config.standalone.js     # vite 单网页打包配置脚本
│
├── package.json                  # 依赖更新
│
├── letsvis-standalone.html       # 打包使用入口
└── index.html                    # 入口


```

## 注意事项

-   本项目使用 ES 模块 (`"type": "module"`)。
-   开发时修改代码会自动热重载。
-   如果遇到依赖安装问题，可尝试删除 `node_modules` 和 `package-lock.json` 后重新安装。



flowchart TD
    subgraph 外部
        LOG[日志文件] 
        USR[用户交互]
    end

    subgraph 解析层
        P[log_parser.py] 
        DC[dep-collector.js]
    end

    subgraph 泳道系统
        LF([lane-factory.js])
        BL[BaseLane]
        GL[GDMALane]
        LL[LayerLane]
        PL[ProfileLane]
    end

    subgraph 配置生成
        OG[option-generators/]
        TO[timestep-option.js]
        PO[profile-option.js]
        LO[lmem-option.js]
        SO[summary-option.js]
    end

    subgraph UI 组件
        BC{{base-chart.vue}}
        TC{{timestep-chart.vue}}
        PC{{profile-chart.vue}}
        LC{{lmem-chart.vue}}
        SC{{memory-summary-chart.vue}}
        DT{{data-table.vue}}
    end

    subgraph 共享状态
        SS[(shared-state.js)]
    end

    LOG -->|原始日志| P
    P -->|entries| DC
    DC -->|entries + deps| LF
    LF -->|createLane| GL & LL & PL
    GL -->|segments| OG
    LL -->|segments| OG
    PL -->|segments| OG
    OG -->|option| TC & PC & LC & SC
    TC -->|render| BC
    PC -->|render| BC
    LC -->|render| BC
    SC -->|render| BC
    BC -->|hover/click| SS
    SS -->|highlightedStep| DT
    USR -->|filter| SS
    SS -->|filteredEntries| OG