<template>
  <div class="lmem-view">
    <div class="toolbar">
      <FileSelector @file-loaded="onFileLoaded" />
      <ComparisonSlider v-if="comparisonData" :data="comparisonData" @compare="onCompare" />
    </div>

    <div class="visualization-area">
      <!-- 主可视化区域 -->
      <div class="main" ref="main">
        <canvas ref="canvas" class="lmem-canvas"></canvas>
        <div ref="tooltip" class="tooltip"></div>
        <button class="reset-btn" @click="lmemRenderer?.resetZoom()" title="Reset zoom">⟲</button>
      </div>

      <!-- 摘要图表区域 -->
      <div class="summary" ref="summaryContainer">
        <canvas ref="summaryCanvas" class="summary-canvas"></canvas>
      </div>
    </div>

      <!-- 规格信息面板 -->
      <div class="specs-panel">
        <lmem-spec-panel 
          :initial-settings="renderData?.settings || {}"
          :available-configs="allLmemConfigs"
          :current-index="currentConfigIndex"
          @config-change="handleConfigChange"
        />
      </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick } from 'vue';
import { LmemRenderer } from '@/core/visualization/renderers/lmem-renderer.js';
import { SummaryRenderer } from '@/core/visualization/renderers/memory-summary.js';
import { ZoomHandler } from '@/core/visualization/controls/zoom-handler.js';
import FileSelector from '@/ui/components/file-selector.vue';
import ComparisonSlider from '@/ui/components/comparison-slider.vue';
import LmemSpecPanel from '@/ui/components/lmem-spec-panel.vue';

/* ---------- 响应式/状态 ---------- */
const canvas = ref(null);
const summaryCanvas = ref(null);
const tooltip = ref(null);
const main = ref(null);
const summaryContainer = ref(null);

const allLmemConfigs = ref([]); // 存储所有LMEM配置
const allSummaries = ref([]);   // 存储所有对应的summary
const currentConfigIndex = ref(0); // 当前选中的配置索引

let lmemRenderer = null;
let summaryChart = null;
let zoomHandler = null;

const comparisonData = ref(null);
const renderData = ref(null); // *** NEW *** 存储当前渲染数据
const bankLabels = ref([]);   // *** NEW *** 存储Bank标签信息

/* ---------- 生命周期 ---------- */
onMounted(async () => {
  // 等待DOM元素完全渲染
  await nextTick();
  
  // 初始化主渲染器
  lmemRenderer = new LmemRenderer(canvas.value, { 
    tooltipElement: tooltip.value 
  });
  await lmemRenderer.init();

  // 初始化摘要图表
  summaryChart = new SummaryRenderer(summaryCanvas.value);
  await summaryChart.init();

  // 初始化缩放控制器 - 传递renderer的viewMatrix引用
  zoomHandler = new ZoomHandler(canvas.value, lmemRenderer.viewMatrix);
  
  zoomHandler.onZoom = (scale) => {
    console.log('Zoom level 在 Vue 中更新为：', scale);
    console.log('After zoom the viewMatrix:', lmemRenderer.viewMatrix); // 添加这行
    if(lmemRenderer){
      lmemRenderer.zoomScale = scale;
    }
    if(lmemRenderer && renderData.value){
      lmemRenderer.render(renderData.value, true); // 缩放渲染
    }
  };

  // // 监听选择事件（用于差异对比）
  lmemRenderer.on('blockSelect', handleBlockSelect);
  lmemRenderer.on('blockHover', handleBlockHover);

  window.addEventListener('resize', onResize);
  onResize();
});

onUnmounted(() => {
  lmemRenderer?.destroy();
  summaryChart?.destroy();
  zoomHandler?.destroy();
  window.removeEventListener('resize', onResize);
});

/* ---------- 事件处理 ---------- */
function onFileLoaded(parsedData) {
  console.log('[LmemView] File loaded:', parsedData);

  // 从解析结果中提取数据和有效性状态
  const { lmem: lmemList, summary: summaryData, valid, chip } = parsedData;
  
  // 检查是否有有效的LMEM数据
  if (valid.lmem && lmemList?.length) {
    // 存储所有配置和对应的summary
    allLmemConfigs.value = lmemList;
    allSummaries.value = summaryData?.groups || [];

    // 传递全局最大内存使用量给渲染器
    if (allSummaries.value.length > 0 && lmemRenderer) {
      const currentSummary = allSummaries.value[0];
      const memoryFootprint = currentSummary?.summary?.totalMemoryFootprint;
      if (memoryFootprint) {
        lmemRenderer.setMemoryFootprint(memoryFootprint);
      }
    }
    
    
    // 合并芯片信息到所有配置
    if (chip) {
      allLmemConfigs.value.forEach(config => {
        Object.assign(config.settings, chip);
      });
    }
    
    // 设置当前配置（默认第一个）
    currentConfigIndex.value = 0;
    renderData.value = allLmemConfigs.value[0];
    
    // 渲染主视图
    lmemRenderer.render(renderData.value);
    
    // 渲染对应的summary数据 - 使用summary.groups中的对应数据
    if (allSummaries.value.length > currentConfigIndex.value) {
      const currentSummary = allSummaries.value[currentConfigIndex.value];
      summaryChart.render(currentSummary);
      console.log('[SummaryData] summary 数据传递检查1：', {settings: currentSummary.settings, stepStatistics: currentSummary.stepStatistics, summary: currentSummary.summary});
    } else {
      console.warn('No corresponding summary data found for config', currentConfigIndex.value);
    }
  } else {
    console.warn('[LmemView] No valid LMEM data received');
  }
}

function handleConfigChange(newIndex) {
  if (newIndex >= 0 && newIndex < allLmemConfigs.value.length) {
    currentConfigIndex.value = newIndex;
    renderData.value = allLmemConfigs.value[newIndex];
    
    // 重新传递最大内存地址
    if (allSummaries.value.length > 0 && lmemRenderer) {
      const currentSummary = allSummaries.value[newIndex];
      const memoryFootprint = currentSummary?.summary?.totalMemoryFootprint;
      if (memoryFootprint) {
        lmemRenderer.setMemoryFootprint(memoryFootprint);
      }
    }
    // 重新渲染主视图
    lmemRenderer.render(renderData.value);
    
    // 渲染对应的summary数据
    if (allSummaries.value.length > newIndex) {
      const currentSummary = allSummaries.value[newIndex];
      summaryChart.render(currentSummary);
      console.log('[SummaryData] summary 数据传递检查2：', {settings: currentSummary.settings, stepStatistics: currentSummary.stepStatistics, summary: currentSummary.summary});
    } else {
      console.warn('No summary data for config index:', newIndex);
    }
  }
}


// function onCompare({ baseline, target }) {
//   // 此处后续集成 diff.worker.js 结果
//   console.log('Compare requested:', s baseline, target });
//   comparisonData.value = { baseline, target };
// }

// function handleBlockSelect(block, selectedSet) {
//   //console.log('Block selected:', block, selectedSet);
//   // 将来用于高亮差异
//   // 可以在这里触发对比分析
// }

// function handleBlockHover(block) {
//   // 可以用于显示更详细的信息或更新状态
//   // console.log('Block hover:', block);
// }

function handleZoom() {
  // *** MODIFIED *** 缩放时重绘
  if (lmemRenderer && renderData.value) {
    lmemRenderer.render(renderData.value);
  }
}

function onResize() {
  if (!main.value || !summaryContainer.value) return;

  const { width, height } = main.value.getBoundingClientRect();
  canvas.value.width = width;
  canvas.value.height = height;

  const { width: sw, height: sh } = summaryContainer.value.getBoundingClientRect();
  summaryCanvas.value.width = sw;
  summaryCanvas.value.height = sh;

  // // *** NEW *** 更新Bank标签位置
  // if (renderData.value) {
  //   updateBankLabels(renderData.value);
  // }

  // 重绘
  if (lmemRenderer && renderData.value) {
    lmemRenderer.render(renderData.value);
  }
  if (summaryChart && renderData.value) {
    // 重新计算摘要或使用之前的数据重绘
    const summary = calculateMemorySummary(renderData.value.allocations);
    summaryChart.render(summary);
  }
}

// *** NEW *** 计算内存使用摘要
function calculateMemorySummary(allocations) {
  if (!allocations?.length) return [];
  
  // 找出最大时间步
  const maxTimestep = Math.max(...allocations.map(a => a.timestep_end));
  
  // 为每个时间步计算总内存使用量
  const summary = [];
  for (let ts = 0; ts <= maxTimestep; ts++) {
    const memoryUsed = allocations
      .filter(a => a.timestep_start <= ts && a.timestep_end >= ts)
      .reduce((sum, a) => sum + a.size, 0);
    
    summary.push({
      timestep: ts,
      memory_used: memoryUsed,
      memory_total: renderData.value?.settings?.lmem_bytes || 0
    });
  }
  
  return summary;
}

</script>


<style scoped>

.lmem-view {
  display: grid;
  grid-template-rows: auto 1fr auto; /* 工具栏、内容区、规格面板 */
  height: 120vh;
  background: #f8f9fa;
}

.toolbar {
  grid-row: 1;
  flex: 0 0 60px;
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0 1.5rem;
  border-bottom: 1px solid #e0e0e0;
  background: white;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}


.visualization-area {
  grid-row: 2;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: auto;
}


.specs-panel {
  grid-row: 3;
  max-height: 40vh; /* 限制最大高度 */
  min-height: 330px; /* 确保最小高度 */
  padding: 12px 20px;
  background: #f5f7f9;
  border-top: 1px solid #dde1e6;
  overflow-y: auto; /* 确保有垂直滚动 */
}


.main {
  flex: 1;
  position: relative;
  min-height: 450px;
  background: white;
  border-bottom: 1px solid #e0e0e0;
}

.lmem-canvas {
  width: 100%;
  height: 100%;
  display: block;
}

.tooltip {
  position: absolute;
  pointer-events: none;
  background: rgba(0, 0, 0, 0.9);
  color: #fff;
  padding: 10px 12px;
  border-radius: 6px;
  font-size: 13px;
  line-height: 1.4;
  z-index: 1000;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  max-width: 300px;
  display: none;
  backdrop-filter: blur(4px);
}

.tooltip.show { 
  display: block; 
  animation: fadeIn 0.15s ease-out;
}

.tooltip-title {
  font-weight: 600;
  margin-bottom: 6px;
  color: #fff;
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
  padding-bottom: 4px;
}

.tooltip div {
  margin: 3px 0;
}

.tooltip span {
  font-weight: 500;
  color: #ccc;
  margin-right: 6px;
}



.summary {
  flex: 0 1 relative;
  min-height: 450px;
  padding: 0px;  
  background: white;
  border-top: 1px solid #e0e0e0;
}

.summary-canvas {
  width: 90%;
  height: 90%;
  background: #fafafa;
  border-radius: 4px;
  border: 1px solid #e0e0e0;
}


.reset-btn {
  position: absolute;
  top: 3px;
  right: 4px;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: none;
  background: #ffffffcc;
  backdrop-filter: blur(2px);
  font-size: 14px;
  cursor: pointer;
  box-shadow: 0 1px 4px rgba(0,0,0,.25);
}
.reset-btn:hover {
  background: #fff;
}


/* 动画 */
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(5px); }
  to { opacity: 1; transform: translateY(0); }
}

/* 响应式设计 */
@media (max-width: 768px) {
  .toolbar {
    padding: 0 1rem;
    flex-wrap: wrap;
    height: auto;
    min-height: 60px;
  }
  
  /* .bank-labels {
    width: 50px;
  }
  
  .bank-label {
    font-size: 10px;
    padding: 2px 4px;
  } */
  
  .summary {
    flex: 0 0 120px;
    padding: 8px;
  }
  
  .specs-panel {
    padding: 10px;
    font-size: 12px;
  }
}
</style>