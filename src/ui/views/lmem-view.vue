<template>
  <div class="lmem-view">
    <!-- 工具栏 -->
    <div class="toolbar">
      <FileSelector @file-loaded="onFileLoaded" />
      <ComparisonSlider
        v-if="comparisonData"
        :data="comparisonData"
        @compare="onCompare"
      />
    </div>

    <!-- 可视化区域 -->
    <div class="visualization-area">
      
      <lmem-chart
        ref="lmemChart"
        :data="renderData"
        :settings="renderData?.settings"
        :comparison="comparisonData"
        @config-change="handleConfigChange"
      />

      <memory-summary-chart
        ref="summaryChart"
        :summary="currentSummary"
      />
    </div>

    <!-- 规格面板 -->
    <lmem-spec-panel
      :initial-settings="renderData?.settings || {}"
      :available-configs="allLmemConfigs"
      :current-index="currentConfigIndex"
      @config-change="handleConfigChange"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import FileSelector from '@/ui/components/file-selector.vue'
import ComparisonSlider from '@/ui/components/comparison-slider.vue'
import LmemSpecPanel from '@/ui/components/lmem-spec-panel.vue'
import LmemChart from '@/ui/components/charts/lmem-chart.vue'
import MemorySummaryChart from '@/ui/components/charts/memory-summary-chart.vue'

/* ----------------- 状态 ----------------- */
const allLmemConfigs = ref([])        // 所有配置
const allSummaries = ref([])          // 对应摘要
const currentConfigIndex = ref(0)     // 当前选中配置
const comparisonData = ref(null)      // 对比数据

/* 计算属性式传递当前数据 */
const renderData = ref(null)
const currentSummary = ref(null)

/* ----------------- 生命周期 ----------------- */
onMounted(async () => {
  await nextTick()
  window.addEventListener('resize', onResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', onResize)
})

/* ----------------- 事件处理 ----------------- */
/** 文件加载完成 */
function onFileLoaded (parsedData) {
  const { lmem: lmemList, summary: summaryData, valid, chip } = parsedData
  console.log('Lmem data:',{ lmem: lmemList, summary: summaryData, valid, chip })

  if (!valid.lmem || !lmemList?.length) {
    console.warn('[LmemView] No valid LMEM data')
    return
  }

  // 保存全部配置与摘要
  allLmemConfigs.value = lmemList
  allSummaries.value = summaryData?.groups || []

  // 合并芯片信息
  if (chip) {
    allLmemConfigs.value.forEach(cfg => Object.assign(cfg.settings, chip))
  }

  // 默认选中第一项
  currentConfigIndex.value = 0
  renderData.value = allLmemConfigs.value[0]
  currentSummary.value = allSummaries.value[0] || null
  
}

/** 规格面板切换配置 */
function handleConfigChange (idx) {
  if (idx < 0 || idx >= allLmemConfigs.value.length) return
  currentConfigIndex.value = idx
  renderData.value = allLmemConfigs.value[idx]
  currentSummary.value = allSummaries.value[idx] || null
}

/** 对比滑块触发（仅保存对比数据，图表内部自行高亮） */
function onCompare ({ baseline, target }) {
  comparisonData.value = { baseline, target }
}

/** 窗口尺寸变化，通知子组件 resize */
function onResize () {
  refs.lmemChart?.resize()
  refs.summaryChart?.resize()
}
</script>

<style scoped>
.lmem-view {
  display: grid;
  grid-template-rows: auto 1fr auto;
  height: 100vh;
  background: #f8f9fa;
}

/* .toolbar {
  flex: 0 0 60px;
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0 1.5rem;
  border-bottom: 1px solid #e0e0e0;
  background: #fff;
  box-shadow: 0 1px 3px rgba(0,0,0,.1);
} */

.visualization-area {
  grid-row: 2;
  display: flex;
  flex-direction: column;
  min-height: 650px;
  height: 100%;
  overflow: hidden;
}

.specs-panel {
  grid-row: 3;
  max-height: 40vh;
  min-height: 330px;
  padding: 12px 20px;
  background: #f5f7f9;
  border-top: 1px solid #dde1e6;
  overflow-y: auto;
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
</style>

