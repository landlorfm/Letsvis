<template>
  <div class="profile-view">
    <!-- 工具栏 -->
    <div class="toolbar">
      <FileSelector @file-loaded="onFileLoaded" />
    </div>


    <!-- 可视化区域 -->
    <div class="visualization-area">
      <profile-chart
        ref="profileChart"
        :data="renderData"
        :visible-keys="visibleKeys"
      />

      <div class="core-switcher embedded">
        <span
          v-for="(_, idx) in allProfileConfigs"
          :key="idx"
          :class="{ active: currentConfigIndex === idx }"
          @click="switchCore(idx)"
        >
           Core{{ idx }}
        </span>
      </div>
    </div>

    <!-- 数据表格面板 -->
    <div class="data-panel">
    <profile-table-filter
        :filter="tableFilter"
        :op-options="opOptions"
        :concerning-op-options="typeOptions"
        @apply="onTableFilterApply"
        @reset="onTableFilterReset"
    />

    <!-- <data-table
        :data="tableData"
        :columns="tableColumns"
        @row-click="onTableRowClick"
    />  -->
    </div>

    <!-- 规格面板（仅当前 settings，无共享项） -->
    <lmem-spec-panel
      :settings="renderData?.settings || {}"
      :shared-keys="[]"
      :legal-snaps="legalSettingsSnap"
      :matched="currentMatchedSetting"
      @local-pick="onLocalPick"
    />
  </div>
</template>

<script setup>
import { ref, nextTick, onMounted, onUnmounted, watch, reactive, computed } from 'vue'
import { sharedParseResult, eventBus, hasValidData } from '@/utils/shared-state'
import FileSelector from '@/ui/components/file-selector.vue'
import ProfileChart from '@/ui/components/charts/profile-chart.vue'
import LmemSpecPanel from '@/ui/components/lmem-spec-panel.vue'
import { useProfileTableData } from '@/core/visualization/table/useProfileTableData.js'
import ProfileTableFilter from '@/ui/components/data-table/profile-table-filter.vue'
import DataTable from '@/ui/components/data-table/data-table.vue'

/* -------- 图表引用 -------- */
const profileChart = ref(null)

/* -------- 状态 -------- */
const renderData = ref(null)
const allProfileConfigs = ref([])
const currentConfigIndex = ref(0)

const legalSettingsSnap = ref([])
const illegalCombo = ref(false)
const currentMatchedSetting = ref({})

/* -------- 统一处理函数 -------- */
function applyParsedData({ profile, chip, valid }) {
  if (!valid.profile || !profile?.length) {
    console.warn('[ProfileView] No valid profile data')
    return
  }
  console.log('Profile data:', { profile, valid, chip })

  allProfileConfigs.value = profile
  currentConfigIndex.value = 0

  if (chip) profile.forEach(c => Object.assign(c.settings, chip))

  legalSettingsSnap.value = profile.map(c => JSON.stringify(c.settings))
  illegalCombo.value = false
  renderData.value = profile[0]
  currentMatchedSetting.value = { ...renderData.value.settings }
  nextTick(() => initTable(renderData.value.entries))

   /* 采样后立刻释放原数组 */
   //profile = null;
}

function switchCore(idx) {
  if (idx === currentConfigIndex.value) return
  currentConfigIndex.value = idx
  renderData.value = allProfileConfigs.value[idx]
  currentMatchedSetting.value = { ...renderData.value.settings }
  nextTick(() => {
    profileChart.value?.resize?.()
    initTable(renderData.value.entries)
  })
}


// const rawDataPool = ref(new Map())  // 原始数据池

// function applyParsedData({ profile, chip, valid }) {
//   if (!valid.profile || !profile?.length) {
//     console.warn('[ProfileView] No valid profile data')
//     return
//   }
//   console.log('Profile data:', { profile, valid, chip })

//   // 使用Map存储，避免数组复制
//   profile.forEach((config, idx) => {
//     rawDataPool.value.set(idx, config)
//   })
  
//   // 共享数据引用
//   allProfileConfigs.value = Array.from(rawDataPool.value.keys())
//   switchCore(0)
// }

// function switchCore(idx) {
//   const config = rawDataPool.value.get(idx)
//   if (!config) return
  
//   // 直接使用共享数据，不复制
//   renderData.value = { 
//     settings: config.settings,
//     get entries() { return config.entries }  // 按需访问
//   }
  
//   currentMatchedSetting.value = { ...renderData.value.settings }
  
//   nextTick(() => {
//     profileChart.value?.resize?.()
//     initTable(idx)  // 传递索引
//   })
// }

/* -------- 生命周期 -------- */
onMounted(async () => {
  await nextTick()
  window.addEventListener('resize', onResize)
  //onResize();

  if (sharedParseResult.valid.profile) {
    applyParsedData(sharedParseResult)
    return
  }
  eventBus.addEventListener('parsed', onParsed)
})

onUnmounted(() => {
  window.removeEventListener('resize', onResize)
  eventBus.removeEventListener('parsed', onParsed)
})

/* -------- 事件处理 -------- */
function onFileLoaded(data) { applyParsedData(data) }
function onParsed(e) { applyParsedData(e.detail) }

function onResize() {
  profileChart.value?.resize()
}

/* -------- 规格面板切换配置 -------- */
function matchIdxBySetting(setting) {
  const snap = legalSettingsSnap.value
  const str = JSON.stringify(setting)
  return snap.findIndex(s => s === str)
}

function applySettingAndMatch(newSetting) {
  const idx = matchIdxBySetting(newSetting)
  if (idx !== -1) {
    illegalCombo.value = false
    currentConfigIndex.value = idx
    renderData.value = allProfileConfigs.value[idx]
    currentMatchedSetting.value = { ...renderData.value.settings }
    nextTick(() => initTable(idx))///initTable(allProfileConfigs.value[idx])) // renderData.value.entries
  } else {
    illegalCombo.value = true
  }
}

function onLocalPick({ key, value }) {
  const preview = { ...renderData.value.settings, [key]: value }
  applySettingAndMatch(preview)
}

const onTableRowClick = (row) => profileChart.value?.highlightRow?.(row)

const tableFilter = reactive({
  startOpMin: null,
  startOpMax: null,
  startMin: 0,
  startMax: 0,
  engine: 'all',
  op: [],
  type: [],
  bdId: 0,
  gdmaId: 0,
  durationMin: 0,
  durationMax: 0
})

let tableAPI = null
const tableData   = ref([])
const opOptions   = ref([])
const typeOptions = ref([]) // 下游组件用 concerningOpOptions 字段名

function initTable(entries) {
  // if (!entries?.length || tableAPI) return

   // 长度校验
  if (!entries?.length) return
  // 如果已经存在实例，先销毁（解决切 Core 不复用）
  if (tableAPI) {
    tableAPI = null
  }
  // 重新创建
  tableAPI = useProfileTableData(ref(entries))
  Object.assign(tableFilter, tableAPI.filter.value)

  watch(tableAPI.filteredRows, newVal => {
    tableData.value = newVal
  }, { immediate: true })

  opOptions.value   = tableAPI.opOptions.value
  typeOptions.value = tableAPI.concerningOpOptions.value // 实际是 type 列表
}

// function initTable(coreIndex) {
//   const config = rawDataPool.value.get(coreIndex)
//   if (!config?.entries?.length) return
  
//   // 如果已经存在实例，先销毁
//   if (tableAPI) {
//     tableAPI = null
//   }
  
//   // 传递原始数据引用
//   tableAPI = useProfileTableData(ref(config.entries))
//   Object.assign(tableFilter, tableAPI.filter.value)

//   watch(tableAPI.filteredRows, newVal => {
//     tableData.value = newVal
//   }, { immediate: true })

//   opOptions.value = tableAPI.opOptions.value
//   typeOptions.value = tableAPI.concerningOpOptions.value
// }

const onTableFilterApply = () => {
  if (!tableAPI) return
  Object.assign(tableAPI.filter.value, tableFilter)
  console.log('View-visibleKeys', visibleKeys)
}

const onTableFilterReset = () => {
  if (!tableAPI) return
  const init = {
    startOpMin: null,
    startOpMax: null,
    startMin: null,
    startMax: null,
    engine: 'all',
    op: [],
    type: [],
    bdId: null,
    gdmaId: null,
    durationMin: null,
    durationMax: null,
    direction: 'all'
  }
  Object.assign(tableAPI.filter.value, init)
  Object.assign(tableFilter, tableAPI.filter.value)
}

/* 与图表联动的可见主键 */
const visibleKeys = computed(() =>
  tableData.value.length
    ? new Set(tableData.value.map(e => `${e.op}-${e.type}-${e.start}`))
    : new Set()
)

/* 表格列头（profile 专用） */
const tableColumns = [
  { prop: 'op', label: 'Op', width: 110 },
  { prop: 'type', label: 'Type', width: 120 },
  { prop: 'engine', label: 'Engine', width: 120 },
  { prop: 'startMs', label: 'Start (ms)', width: 120, sortable: true },
  { prop: 'endMs', label: 'End (ms)', width: 120, sortable: true },
  { prop: 'durationMs', label: 'Cost (ms)', width: 130, sortable: true },
  { prop: 'bd_id', label: 'bd_id', width: 110 },
  { prop: 'gdma_id', label: 'gdma_id', width: 110 },
  { prop: 'direction', label: 'Direction', width: 110 },
  { prop: 'size', label: 'Size', width: 110 },
  { prop: 'bandwidth', label: 'Bandwidth', width: 110, sortable: true },
]
</script>

<style scoped>
.profile-view {
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

.data-panel {
  margin: 12px;
  background: #fff;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
}

.error-mask {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 999;
}

.error-box {
  background: #fff;
  padding: 16px 24px;
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  display: flex;
  align-items: center;
  gap: 12px;
}

.visualization-area {
  position: relative;          /* 作为嵌入按钮的包含块 */
  height: 100%;
  min-height: 500px;
  overflow: hidden;
  background: #fff;            /* 与图表画布同色 */
  border: 1px solid #e0e0e0;
  border-radius: 6px;
}

/* ---------- 嵌入型 Core 切换器 ---------- */
.core-switcher.embedded {
  position: absolute;
  top: 12px;
  left: 50%;
  transform: translateX(-50%); /* 水平居中 */
  z-index: 10;                 /* 浮在图表上方 */
  display: flex;
  gap: 6px;
  padding: 6px 8px;
  background: rgba(255, 255, 255, 0.45); /* 毛玻璃效果 */
  backdrop-filter: blur(4px);
  border-radius: 4px;
}

.core-switcher.embedded span {
  padding: 0 10px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  color: #606266;
  border: 1px solid rgba(64, 158, 255, 0.25);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.core-switcher.embedded span:hover {
  border-color: #409eff;
  color: #409eff;
}

.core-switcher.embedded span.active {
  background: #409eff;
  color: #fff;
  border-color: #409eff;
}
</style>