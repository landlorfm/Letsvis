<!-- ===================================================================
  @component LMemChart
  @summary 基于 ECharts 的“内存分配”可视化组件，支持缩放、重置、自适应。
==================================================================== -->
<template>
  <div class="lmem-chart">
    <div ref="chartDom" class="chart-main"></div>
    <button class="reset-btn" @click="resetZoom" title="Reset zoom">⟲</button>
  </div>
</template>
<script setup>
/**
 * LMemChart – 内存分配可视化
 * @module components/LMemChart
 * @fires resize  当窗口尺寸变化时，图表自动 resize（无参数）
 */
import { ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import * as echarts from 'echarts'
import { generateLmemOption } from '@/core/visualization/option-generators/lmem-option.js'

/* ---------- props ---------- */
/**
 * 图表数据
 * @prop {Array}  props.data.allocations  内存分配段数组，必填
 * @prop {Object} props.data.settings    图表外观配置
 * @prop {Object} props.settings         预留透传 ECharts 全局配置
 */
const props = defineProps({
  data:     { type: Object, default: null },
  settings: { type: Object, default: null }
})

/* ---------- DOM & 实例 ---------- */
const chartDom = ref(null)
let chartInst = null          // 每次挂载重新创建

/* ---------- 生命周期：挂载后才 init ---------- */
onMounted(() => {
  chartInst = echarts.init(chartDom.value)
  doRender()                 // 立即画一次（数据可能早已就绪）
})

onBeforeUnmount(() => {
  chartInst?.dispose()
  chartInst = null
})

/* ---------- 监听数据 ---------- */
watch(() => props.data, () => doRender(), { immediate: false })

/**
 * 渲染或重绘图表
 * @private
 */
function doRender() {
  if (!chartInst || !props.data) return
  chartInst.clear()
  const opt = generateLmemOption(props.data.allocations, props.data.settings)
  chartInst.setOption(opt, true)
}

/* ---------- 缩放重置 ---------- */
/**
 * 重置缩放
 * @public
 */
const resetZoom = () => {
  chartInst?.dispatchAction({ type: 'dataZoom', start: 0, end: 100 })
}

/* ---------- resize ---------- */
function resize() { chartInst?.resize() }
defineExpose({ resize })
window.addEventListener('resize', resize)
onBeforeUnmount(() => window.removeEventListener('resize', resize))
</script>

<style scoped>
.lmem-chart {
  position: relative;
  flex: 1 1 auto;        
  min-height: auto;     
  display: flex;
  flex-direction: column;
}
.chart-main {
  flex: 1 1 400px; 
  min-height: 400px;      
}
.reset-btn {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 10;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: none;
  background: #ffffffcc;
  backdrop-filter: blur(2px);
  font-size: 14px;
  cursor: pointer;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.25);
}
.reset-btn:hover {
  background: #fff;
}
</style>

<!-- <template>
  <div class="lmem-chart">
    <div ref="chartDom" class="chart-main"></div>
    <button class="reset-btn" @click="resetZoom" title="Reset zoom">⟲</button>
  </div>
</template>

<script setup>
import { ref, watch, onUnmounted, nextTick, onActivated } from 'vue'
import * as echarts from 'echarts'
import { generateLmemOption } from '@/core/visualization/option-generators/lmem-option.js'

/* ---------- props ---------- */
const props = defineProps({
  data:     { type: Object, default: null }, // { allocations, settings }
  settings: { type: Object, default: null }
})

/* ---------- 图表实例 ---------- */
const chartDom = ref(null)
let chartInst = null



/* ---------- 渲染 ---------- */
const renderChart = async () => {
  if (!props.data) return
  await nextTick()
  
  if (!chartInst) chartInst = echarts.init(chartDom.value)
  // 清除上次数据，防止刻度错位
  chartInst.clear()
  //console.log('Lmem Data', props.data.allocations)
  const opt = generateLmemOption(props.data.allocations, props.data.settings)

  chartInst.setOption(opt, true)
}

watch(() => props.data, renderChart, { immediate: true })


/* ---------- 缩放重置 ---------- */
const resetZoom = () => {
  chartInst?.dispatchAction({ type: 'dataZoom', start: 0, end: 100 })
}

/* ---------- 自动 resize ---------- */
const onResize = () => chartInst?.resize()
window.addEventListener('resize', onResize)

onUnmounted(() => {
  window.removeEventListener('resize', onResize)
  chartInst?.dispose()
  chartInst = null
})
</script>

<style scoped>
.lmem-chart {
  position: relative;
  flex: 1 1 auto;        
  min-height: auto;     
  display: flex;
  flex-direction: column;
}
.chart-main {
  flex: 1 1 400px; 
  min-height: 400px;      
}
.reset-btn {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 10;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: none;
  background: #ffffffcc;
  backdrop-filter: blur(2px);
  font-size: 14px;
  cursor: pointer;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.25);
}
.reset-btn:hover {
  background: #fff;
}
</style> -->

