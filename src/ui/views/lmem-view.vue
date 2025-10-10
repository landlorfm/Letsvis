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

    <div v-if="illegalCombo" class="error-mask">
      <div class="error-box">
        <span>⚠️ 当前配置组合不存在，请重新选择！</span>
        <button @click="illegalCombo = false">知道了</button>
      </div>
    </div>

    <!-- 可视化区域 -->
    <div class="visualization-area">
      
      <lmem-chart
        ref="lmemChart"
        :data="renderData"
        :settings="renderData?.settings"
        :comparison="comparisonData"
        @config-onLocalPick="onLocalPick"
      />

      <memory-summary-chart
        ref="summaryChart"
        :summary="currentSummary"
      />
    </div>

    <!-- 规格面板 -->
    <lmem-spec-panel
      :settings="renderData?.settings || {}"
      :shared-keys="['shape_secs']"
      :legal-snaps="legalSettingsSnap"
      :matched="currentMatchedSetting"
      @local-pick="onLocalPick"
    />

  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick, onActivated, onDeactivated } from 'vue'
import { sharedParseResult, sharedConfig, eventBus, hasValidData } from '@/utils/shared-state.js'
import FileSelector from '@/ui/components/file-selector.vue'
import ComparisonSlider from '@/ui/components/comparison-slider.vue'
import LmemSpecPanel from '@/ui/components/lmem-spec-panel.vue'
import LmemChart from '@/ui/components/charts/lmem-chart.vue'
import MemorySummaryChart from '@/ui/components/charts/memory-summary-chart.vue'


/* ----------------- 图表引用 ----------------- */
const lmemChart = ref(null)        // lmem-chart 组件引用
const summaryChart = ref(null)     // memory-summary-chart 组件引用

/* ----------------- 状态 ----------------- */
const allLmemConfigs = ref([])        // 所有配置
const allSummaries = ref([])          // 对应摘要
const currentConfigIndex = ref(0)     // 当前选中配置
const comparisonData = ref(null)      // 对比数据

/* 计算属性式传递当前数据 */
const renderData = ref(null)
const currentSummary = ref(null)

/* 合法 setting 快照 */
const legalSettingsSnap = ref([])      // 所有合法 setting 快照
const illegalCombo      = ref(false)   // 非法组合标志
const currentMatchedSetting = ref({}) // 当前匹配的 setting


/* 统一处理函数 */
function applyParsedData ({ lmem, summary, chip, valid }) {
  if (!valid.lmem || !lmem?.length) {
    console.warn('[LmemView] No valid LMEM data')
    return
  }
  // debugger
  console.log('Lmem data:',{ lmem: lmem, summary: summary, valid, chip })

  // 存储当前数据
  allLmemConfigs.value = lmem
  allSummaries.value = summary?.groups || []

  // 合并芯片信息
  if (chip) lmem.forEach(c => Object.assign(c.settings, chip))

   //  生成快照（仅 settings）
  legalSettingsSnap.value = lmem.map(c => JSON.stringify(c.settings))

  // 默认渲染第一项
  currentConfigIndex.value = 0
  renderData.value = allLmemConfigs.value[0]
  currentSummary.value = allSummaries.value[0] || null
  illegalCombo.value = false // 初始合法
  currentMatchedSetting.value = {...renderData.value.settings}
}

/* ----------------- 生命周期 ----------------- */
onMounted(async () => {
  await nextTick()
  window.addEventListener('resize', onResize)

  if (hasValidData()) {
    applyParsedData(sharedParseResult)
    return
  }
  eventBus.addEventListener('parsed', onParsed)
})

onUnmounted(() => {
  window.removeEventListener('resize', onResize)
  eventBus.removeEventListener('parsed', onParsed)
})

/*--------------- 路由切换 ----------------- */
onActivated(() => {
  // 回到页面，ECharts 容器尺寸可能变化，手动 resize
  onResize()
})

onDeactivated(() => {

})



/* ----------------- 事件处理 ----------------- */
/* 事件 */
function onParsed (e) { applyParsedData(e.detail) }

/* 兼容旧的 file-loaded */
function onFileLoaded (data) { applyParsedData(data) }


/** 规格面板切换配置 */
// 拼好当前 setting → 找 idx 
function matchIdxBySetting(setting) {
  const snap = legalSettingsSnap.value
  const str = JSON.stringify(setting)
  return snap.findIndex(s => s === str)
}

// 核心：共享 or 私有变化都走这里 
function applySettingAndMatch(newSetting) {
  const idx = matchIdxBySetting(newSetting)
  if (idx !== -1) {
    illegalCombo.value = false
    currentConfigIndex.value = idx
    renderData.value = allLmemConfigs.value[idx]
    currentSummary.value = allSummaries.value[idx] || null
    currentMatchedSetting.value = {...renderData.value.settings}
    console.log('Matched setting:', currentMatchedSetting.value)
  } else {
    illegalCombo.value = true   // 只弹错，不写回
  }
}

/* 1. 共享项被别的页面改了 */
eventBus.addEventListener('shared-config-changed', () => {
  const s = { ...renderData.value.settings, ...sharedConfig }
  applySettingAndMatch(s)
})

/* 2. 面板里非共享下拉改了 */
function onLocalPick ({ key, value }) {
  // 先拼一份“预览” setting
  const preview = { ...renderData.value.settings, [key]: value }
  applySettingAndMatch(preview)
}

/** 对比滑块触发（仅保存对比数据，图表内部自行高亮） */
function onCompare ({ baseline, target }) {
  comparisonData.value = { baseline, target }
}

/** 窗口尺寸变化，通知子组件 resize */
function onResize() {
  // 调用两个图表组件的 resize 方法
  lmemChart.value?.resize?.()
  summaryChart.value?.resize?.()
}

/* 监听共享字段变化 */
eventBus.addEventListener('shared-config-changed', e => {
  const { key, value } = e.detail
  if (!renderData.value) return
  // 把共享字段写进当前配置（ECharts 会响应式重绘）
  renderData.value.settings[key] = value
})

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

