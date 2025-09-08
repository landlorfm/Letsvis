<template>
  <div class="timestep-view">
    <div class="toolbar">
      <FileSelector @file-loaded="onFileLoaded" />
      <div class="zoom-controls">
        <button @click="zoomIn">+</button>
        <button @click="zoomOut">-</button>
        <button @click="resetZoom">Reset</button>
      </div>
     <!-- </div> -->

      <!-- <div class="range-selector">
        <span>时间范围:</span>
        <input 
          v-model.number="rangeStart" 
          type="number" 
          min="0" 
          :max="totalTimesteps - 1"
          placeholder="开始"
          class="range-input"
          @change="updateTimeRange"
        >
        <span>-</span>
        <input 
          v-model.number="rangeEnd" 
          type="number" 
          min="0" 
          :max="totalTimesteps - 1"
          placeholder="结束"
          class="range-input"
          @change="updateTimeRange"
        >
        <button @click="applyTimeRange" class="apply-btn">应用</button>
        <button @click="clearTimeRange" class="clear-btn">清除</button>
      </div> -->
    </div>

    <div class="visualization-area">
      <div class="main" ref="main">
        <canvas ref="canvas" class="timestep-canvas"></canvas>
        <div ref="tooltip" class="tooltip"></div>
      </div>
    </div>

    <div class="stats-panel" v-if="renderData">
      <h3>时间步统计</h3>
      <p>总时间步: {{ totalTimesteps }}</p>
      <p>compute操作: {{ computeOperations }}</p>
      <p>load操作: {{ loadOperations }}</p>
      <p>store操作: {{ storeOperations }}</p>
      <lmem-spec-panel 
          :initial-settings="renderData?.settings || {}"
          :available-configs="allLmemConfigs"
          :current-index="currentConfigIndex"
          @config-change="handleConfigChange"
        />

      <!-- <div v-if="selectedTimeRange[0] !== null && selectedTimeRange[1] !== null" class="selected-range-info">
        <h4>选中范围</h4>
        <p>时间步: {{ selectedTimeRange[0] }} - {{ selectedTimeRange[1] }}</p>
        <p>持续时间: {{ selectedTimeRange[1] - selectedTimeRange[0] + 1 }} 步</p>
        <p>操作数量: {{ selectedOperationsCount }}</p>
      </div> -->

    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick, computed } from 'vue';
import { TimestepRenderer } from '@/core/visualization/renderers/timestep-renderer.js';
import FileSelector from '@/ui/components/file-selector.vue';
import LmemSpecPanel from '@/ui/components/lmem-spec-panel.vue';

// 响应式状态
const canvas = ref(null);
const tooltip = ref(null);
const main = ref(null);
const renderData = ref(null);
const timestepRenderer = ref(null);


// 计算属性
const totalTimesteps = computed(() => renderData.value?.length || 0);
const computeOperations = computed(() => 
  renderData.value?.reduce((sum, ts) => sum + (ts.compute?.length || 0), 0) || 0
);
const loadOperations = computed(() => 
  renderData.value?.reduce((sum, ts) => sum + (ts.loads?.length || 0), 0) || 0
);
const storeOperations = computed(() => 
  renderData.value?.reduce((sum, ts) => sum + (ts.stores?.length || 0), 0) || 0
);

// 生命周期钩子
onMounted(async () => {
  await nextTick();
  
  // 初始化渲染器
  timestepRenderer.value = new TimestepRenderer({
    canvas: canvas.value,
    tooltipElement: tooltip.value,
    onOperationSelect: handleOperationSelect,
    onOperationHover: handleOperationHover
  });
  
  window.addEventListener('resize', onResize);
  onResize();
});

onUnmounted(() => {
  timestepRenderer.value?.destroy();
  window.removeEventListener('resize', onResize);
});

// 事件处理
function onFileLoaded(parsedData) {
  let timestepData = parsedData;
  
  if (parsedData && parsedData.timestep) {
    timestepData = parsedData.timestep;
  }
  
  if (!timestepData?.length) {
    console.warn('[TimestepView] No valid timestep data received');
    return;
  }

  renderData.value = timestepData;
  
  // 更新渲染器数据
  timestepRenderer.value.setData(timestepData);
  
  // 触发渲染
  timestepRenderer.value.render();
}

function handleOperationSelect(operation, selectedSet) {
  console.log('Operation selected:', operation, selectedSet);

  // 可以在这里触发其他操作，比如显示详细信息面板
}




function handleOperationHover(operation) {
  // 悬停处理，如果需要可以在Vue组件中做额外处理
}

function zoomIn() {
  timestepRenderer.value?.zoomIn();
}

function zoomOut() {
  timestepRenderer.value?.zoomOut();
}

function resetZoom() {
  timestepRenderer.value?.resetZoom();
}

function onResize() {
  if (!main.value) return;

  const { width, height } = main.value.getBoundingClientRect();
  canvas.value.width = width;
  canvas.value.height = height;

  // 通知渲染器重绘
  timestepRenderer.value?.render();
}
</script>

<style scoped>
.timestep-view {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #f8f9fa;
}

.toolbar {
  flex: 0 0 60px;
  display: flex;
  align-items: center;
  padding: 0 1.5rem;
  border-bottom: 1px solid #e0e0e0;
  background: white;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.visualization-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.main {
  flex: 1;
  position: relative;
  min-height: 500px;
  background: white;
}

.timestep-canvas {
  width: 100%;
  height: 100%;
  display: block;
  cursor: grab;
}

.timestep-canvas:active {
  cursor: grabbing;
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

.tooltip .tooltip-title {
    font-weight: 600;
    margin-bottom: 8px;
    color: #fff;
    border-bottom: 1px solid rgba(255, 255, 255, 0.2);
    padding-bottom: 6px;
}

.tooltip div {
    margin: 4px 0;
    display: flex;
    align-items: center;
}

.tooltip span:first-child {
    font-weight: 500;
    color: #aaa;
    min-width: 80px;
    margin-right: 8px;
}

.stats-panel {
  flex: 0 0 auto;
  padding: 12px 20px;
  background: #f5f7f9;
  border-top: 1px solid #dde1e6;
  font-size: 13px;
}

.stats-panel h3 {
  margin: 0 0 8px 0;
  color: #2c3e50;
  font-size: 15px;
  font-weight: 600;
}

.stats-panel p {
  margin: 5px 0;
  color: #5c6b7a;
  line-height: 1.4;
}

.zoom-controls {
  margin-left: auto;
  display: flex;
  gap: 8px;
}

.zoom-controls button {
  padding: 6px 12px;
  background: #f0f0f0;
  border: 1px solid #ddd;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.2s;
}

.zoom-controls button:hover {
  background: #e0e0e0;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(5px); }
  to { opacity: 1; transform: translateY(0); }
}

@media (max-width: 768px) {
  .toolbar {
    padding: 0 1rem;
  }
  
  .stats-panel {
    padding: 10px;
    font-size: 12px;
  }
}
</style>
