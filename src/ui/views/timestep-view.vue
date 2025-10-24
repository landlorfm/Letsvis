<template>
  <div class="timestep-view">
    <!-- 工具栏 -->
    <div class="toolbar">
      <FileSelector @file-loaded="onFileLoaded" />
    </div>

    <!-- 可视化区域 -->
    <div class="visualization-area">
      <timestep-chart
        ref="timestepChart"
        :data="renderData"
        :settings="renderData?.settings"
        :visible-keys="visibleKeys" 
      />
    </div>

    <!-- 数据表格面板 -->
    <div class="data-panel">
      <table-filter
          :filter="tableFilter"
          :op-options="opOptions"
          :concerning-op-options="concerningOpOptions"
          @apply="onTableFilterApply"
          @reset="onTableFilterReset"/>
      <data-table
          :data="tableData"
          @row-click="onTableRowClick"/>
    </div>

    <!-- 规格面板 -->
    <lmem-spec-panel
      :settings="renderData?.settings || {}"
      :shared-keys="['shape_secs']"
      :legal-snaps="legalSettingsSnap"
      :matched="currentMatchedSetting"
      :illegal="illegalCombo"
      @local-pick="onLocalPick"
      @close-err="illegalCombo = false"
    />
  </div>
</template>

<script setup>
import { ref, nextTick, onMounted, onUnmounted, onActivated, onDeactivated, watch, reactive, computed } from 'vue'
import { sharedParseResult, sharedConfig, eventBus, hasValidData } from '../../utils/shared-state'
import FileSelector from '@/ui/components/file-selector.vue'
import TimestepChart from '@/ui/components/charts/timestep-chart.vue'
import LmemSpecPanel from '@/ui/components/lmem-spec-panel.vue'

import { useTableData } from '@/core//visualization/table/useTableData.js'
import TableFilter from '@/ui/components/data-table/table-filter.vue'
import DataTable   from '@/ui/components/data-table/data-table.vue'

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
  nextTick(() => initTable(renderData.value.entries))
}


/* -------- 生命周期 -------- */
onMounted(async () => {
  await nextTick()
  window.addEventListener('resize', onResize)

  // 先等解析事件
   eventBus.addEventListener('parsed', onParsed)

  // 已有缓存直接用
  if (sharedParseResult.valid.timestep) {
    applyParsedData(sharedParseResult)
    return
  }
  // // 等待后续广播
  // eventBus.addEventListener('parsed', onParsed)
})

onUnmounted(() => {
  window.removeEventListener('resize', onResize)
  eventBus.removeEventListener('parsed', onParsed)
})


// /*--------------- 路由切换 ----------------- */
onActivated(() => {
  // 回到页面，ECharts 容器尺寸可能变化，手动 resize
  onResize()
  // eventBus.addEventListener('parsed', onParsed)
})

onDeactivated(() => {
  // eventBus.removeEventListener('parsed', onParsed)

})


/* -------- 事件处理 -------- */
/* 兼容旧的 file-loaded */
function onFileLoaded (data) { }//applyParsedData(data) }


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
    nextTick(() => initTable(renderData.value.entries))
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

/** ----------  表格组件使用  ---------- */
/* 缺失函数 - 直接留空即可（数据已响应式） */
const onTableRowClick = (row) => timestepChart.value?.highlightRow?.(row)

/* 缺失变量 - 先给空壳，避免 undefined 访问 */
const tableFilter = reactive({
  timestepMin: 0, timestepMax: 0, timestepType: 'all',
  op: [], concerningOp: [], concerningOpName: '', tensorName: '',
  durationMin: 0, durationMax: 0
})

/* 空值保护 - 等有数据再实例化 filter & 表格 */
let tableAPI = null            // 保存 useTableData 实例
const tableData = ref([])      // 给表格用的数据
const opOptions = ref([])
const concerningOpOptions = ref([])


function initTable(entries) {
  //if (!entries?.length || tableAPI) return

  // 创建实例 
  tableAPI = useTableData(ref(entries))
  // 把初始值同步到面板 
  Object.assign(tableFilter, tableAPI.filter.value)

  // 后续过滤结果持续写回 tableData 
  watch(
    tableAPI.filteredRows,
    newVal => { 
      tableData.value = newVal},
    { immediate: true }
  )
  // 下拉选项 
  opOptions.value = tableAPI.opOptions.value
  concerningOpOptions.value = tableAPI.concerningOpOptions.value
}

/*  面板按钮事件：现在把值写回核心 */
const onTableFilterApply = () => {
  if (!tableAPI) return
  /* 整包写回去， reactive 会触发 filteredRows 重新计算 */
  Object.assign(tableAPI.filter.value, tableFilter)
  console.log('visibleKeys', {visibleKeys});
}

/* 重置：先让核心恢复初始值，再同步回面板 */
const onTableFilterReset = () => {
  if (!tableAPI) return
  const init = {
    timestepMin: null,
    timestepMax: null,
    timestepType: 'all',
    op: [],
    concerningOp: [],
    concerningOpName: '',
    tensorName: '',
    durationMin: null,
    durationMax: null
  }
  Object.assign(tableAPI.filter.value, init)
  Object.assign(tableFilter, tableAPI.filter.value)
}

/* 过滤掩码：只存“当前表格可见行”的主键 */
const visibleKeys = computed(() =>
  tableData.value.length
    ? new Set(tableData.value.map(e => `${e.timestep}-${e.op}-${e.tensor_name}`))
    : new Set()
)



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
  min-height: 450px;
  overflow: hidden;
}

.data-panel { 
  margin: 12px; 
  background: #fff; 
  border: 1px solid #e0e0e0; 
  border-radius: 4px; 
}
</style>