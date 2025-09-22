<template>
  <div class="timestep-view">
    <!-- 工具栏 -->
    <div class="toolbar">
      <FileSelector @file-loaded="onFileLoaded" />
    </div>

    <div v-if="illegalCombo" class="error-mask">
      <div class="error-box">
        <span>⚠️ 当前配置组合不存在，请重新选择！</span>
        <button @click="illegalCombo = false">知道了</button>
      </div>
    </div>

    <!-- 可视化区域 -->
    <div class="visualization-area">
      <timestep-chart
        ref="timestepChart"
        :data="renderData"
        :settings="renderData?.settings"
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
import { ref, nextTick, onMounted, onUnmounted } from 'vue'
import { sharedParseResult, eventBus, hasValidData } from '../../utils/shared-state'
import FileSelector from '@/ui/components/file-selector.vue'
import TimestepChart from '@/ui/components/charts/timestep-chart.vue'
import LmemSpecPanel from '@/ui/components/lmem-spec-panel.vue'

/* -------- 图表引用 -------- */
const timestepChart = ref(null)   // timestep-chart 组件引用

/* -------- 状态 -------- */
const renderData = ref(null)   // 当前选中配置 {settings, entries}
const allTimestepConfigs = ref([])
const currentConfigIndex = ref(0)


/* 合法 setting 快照 */
const legalSettingsSnap = ref([])      // 所有合法 setting 快照
const illegalCombo      = ref(false)   // 非法组合标志
const currentMatchedSetting = ref({}) // 当前匹配的 setting


/* 统一处理函数 */
function applyParsedData ({timestep, chip, valid }) {
  if (!valid.timestep || !timestep?.length) {
    console.warn('[TimestepView] No valid timestep data')
    return
  }
  console.log('Timestep data:', { timestep: timestep, valid, chip })

  // 存储当前数据
  allTimestepConfigs.value = timestep
  currentConfigIndex.value = 0

  // 把芯片信息合并到 settings
  if (chip) timestep.forEach(c => Object.assign(c.settings, chip))

  //  生成快照（仅 settings）
  legalSettingsSnap.value = timestep.map(c => JSON.stringify(c.settings))

  // 默认显示第一组配置
  renderData.value = timestep[0]
  illegalCombo.value = false // 初始合法
  currentMatchedSetting.value = {...renderData.value.settings}
}

/* -------- 生命周期 -------- */
onMounted(async () => {
  await nextTick()
  window.addEventListener('resize', onResize)

    // 1. 已有缓存直接用
  if (hasValidData()) {
    applyParsedData(sharedParseResult)
    return
  }
  // 2. 等待后续广播
  eventBus.addEventListener('parsed', onParsed)
})

onUnmounted(() => {
  window.removeEventListener('resize', onResize)
  eventBus.removeEventListener('parsed', onParsed)
})

/* -------- 事件处理 -------- */
/* 兼容旧的 file-loaded */
function onFileLoaded (data) { applyParsedData(data) }


/**解析数据改变 */
function onParsed (e){
  applyParsedData(e.detail)
}

/** 窗口尺寸变化 */
function onResize () {
  timestepChart?.value?.resize()
}

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
    renderData.value = allTimestepConfigs.value[idx]
    currentMatchedSetting.value = {...renderData.value.settings}
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

</script>

<style scoped>
.timestep-view {
  display: grid;
  grid-template-rows: auto 1fr;
  height: 100vh;
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
  height: 100%;
  min-height: 650px;
  overflow: hidden;
}
</style>