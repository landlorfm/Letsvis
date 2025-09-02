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
      </div>

      <!-- 摘要图表区域 -->
      <div class="summary" ref="summaryContainer">
        <canvas ref="summaryCanvas" class="summary-canvas"></canvas>
      </div>
    </div>

    <!-- 规格信息面板 -->
    <div class="specs-panel" v-if="renderData?.settings">
      <h3>Local Memory Allocation</h3>
      <p>SPEC: LmemSize(Byte)={{ renderData.settings.lmem_bytes }}, 
          BankSize(Byte)={{ renderData.settings.lmem_bank_bytes }},
          Banks={{ renderData.settings.lmem_banks }}</p>
      <p>SETTINGS: allow_bank_conflict={{ renderData.settings.allow_bank_conflict }}, 
          shape_secs={{ renderData.settings.shape_secs }}</p>
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

/* ---------- 响应式/状态 ---------- */
const canvas = ref(null);
const summaryCanvas = ref(null);
const tooltip = ref(null);
const main = ref(null);
const summaryContainer = ref(null);

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

  // 监听选择事件（用于差异对比）
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
  
  // *** MODIFIED *** 适应Worker返回的数据结构
  let lmemData = parsedData;
  let summaryData = null;
  
  if (parsedData && parsedData.lmem) {
    // { lmem, timestep, summary } 格式
    lmemData = parsedData.lmem[0]; // 取第一个LMEM数据
    summaryData = parsedData.summary;
  }
  
  if (!lmemData?.allocations?.length) {
    console.warn('[LmemView] No valid allocation data received');
    return;
  }

  // 存储渲染数据
  renderData.value = lmemData;
  
  // // 更新Bank标签
  // updateBankLabels(lmemData);
  
  // 渲染主视图
  lmemRenderer.render(lmemData);
  
  // 渲染摘要图表（如果有摘要数据）
  if (summaryData) {
    summaryChart.render(summaryData); }
  // } else if (lmemData.allocations) {
  //   // *** NEW *** 如果没有摘要数据，可以根据allocations实时计算
  //   const calculatedSummary = calculateMemorySummary(lmemData.allocations);
  //   summaryChart.render(calculatedSummary);
  // }
}

function onCompare({ baseline, target }) {
  // 此处后续集成 diff.worker.js 结果
  console.log('Compare requested:', { baseline, target });
  comparisonData.value = { baseline, target };
}

function handleBlockSelect(block, selectedSet) {
  console.log('Block selected:', block, selectedSet);
  // 将来用于高亮差异
  // 可以在这里触发对比分析
}

function handleBlockHover(block) {
  // 可以用于显示更详细的信息或更新状态
  // console.log('Block hover:', block);
}

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

// *** NEW *** 更新Bank标签
function updateBankLabels(lmemData) {
  if (!lmemData?.settings || !main.value) {
    bankLabels.value = [];
    return;
  }

  const { lmem_bytes, lmem_bank_bytes, lmem_banks } = lmemData.settings;
  const bankSize = lmem_bank_bytes || (lmem_bytes / (lmem_banks || 16));
  const numBanks = lmem_banks || Math.ceil(lmem_bytes / bankSize);
  
  const containerHeight = main.value.clientHeight;
  
  bankLabels.value = Array.from({ length: numBanks }, (_, i) => {
    // 计算每个Bank的位置（百分比）
    const position = ((i * bankSize) / lmem_bytes) * 100;
    return {
      index: i,
      position: Math.min(100, Math.max(0, position))
    };
  }).filter(bank => bank.position <= 100); // 只显示在可视范围内的Bank
}
</script>

<style scoped>
.lmem-view {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #f8f9fa;
}

.toolbar {
  flex: 0 0 60px;
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0 1.5rem;
  border-bottom: 1px solid #e0e0e0;
  background: white;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

/* .visualization-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0; 
} */

.visualization-area {
  flex: 1 1 auto;   /* 占满剩余空间 */
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: auto;   /* 关键：出现滚动条而不是溢出 */
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
  padding: 5px;
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

.specs-panel {
  flex: 0 0 auto;   /* 不会被压缩，也不会再往上顶 */
  padding: 12px 20px;
  background: #f5f7f9;
  border-top: 1px solid #dde1e6;
  font-size: 13px;
}

.specs-panel h3 {
  margin: 0 0 8px 0;
  color: #2c3e50;
  font-size: 15px;
  font-weight: 600;
}

.specs-panel p {
  margin: 5px 0;
  color: #5c6b7a;
  line-height: 1.4;
}

.bank-labels {
  position: absolute;
  right: 8px;
  top: 0;
  bottom: 0;
  width: 70px;
  pointer-events: none;
  z-index: 100;
}

.bank-label {
  position: absolute;
  right: 0;
  font-size: 11px;
  color: #666;
  background: rgba(255, 255, 255, 0.9);
  padding: 3px 6px;
  border-radius: 3px;
  border: 1px solid #e0e0e0;
  transform: translateY(50%);
  white-space: nowrap;
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
  
  .bank-labels {
    width: 50px;
  }
  
  .bank-label {
    font-size: 10px;
    padding: 2px 4px;
  }
  
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