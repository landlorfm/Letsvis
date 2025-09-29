<template>
  <div class="profile-view">
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
      <profile-chart
        ref="profileChart"
        :data="renderData"
        :visible-keys="visibleKeys" 
      />
    </div>

    <!-- 数据表格面板 -->
    <div class="data-panel">
    <!-- 1. 筛选面板（profile 专用） -->
    <profile-table-filter
        :filter="tableFilter"
        :op-options="opOptions"
        :concerning-op-options="typeOptions"
        @apply="onTableFilterApply"
        @reset="onTableFilterReset"
    />

    <!-- 2. 数据表格（复用原 data-table.vue，只换列头） -->
    <data-table
        :data="tableData"
        :columns="tableColumns"
        @row-click="onTableRowClick"
    />
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
}

/* -------- 生命周期 -------- */
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
    nextTick(() => initTable(renderData.value.entries))
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
  if (!entries?.length || tableAPI) return

  tableAPI = useProfileTableData(ref(entries))
  Object.assign(tableFilter, tableAPI.filter.value)

  watch(tableAPI.filteredRows, newVal => {
    tableData.value = newVal
  }, { immediate: true })

  opOptions.value   = tableAPI.opOptions.value
  typeOptions.value = tableAPI.concerningOpOptions.value // 实际是 type 列表
}

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
    durationMax: null
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
  { prop: 'op', label: 'Op', width: 120 },
  { prop: 'type', label: 'Type', width: 150 },
  { prop: 'engine', label: 'Engine', width: 120 },
  { prop: 'startMs', label: 'Start (ms)', width: 120, sortable: true },
  { prop: 'endMs', label: 'End (ms)', width: 120, sortable: true },
  { prop: 'durationMs', label: 'Cost (ms)', width: 130, sortable: true },
  { prop: 'bd_id', label: 'bd_id', width: 110 },
  { prop: 'gdma_id', label: 'gdma_id', width: 100 }
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

.visualization-area {
  grid-row: 2;
  height: 100%;
  min-height: 450px;
  overflow: hidden;
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
</style>