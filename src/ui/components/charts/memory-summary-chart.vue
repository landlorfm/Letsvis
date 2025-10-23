<template>
  <div ref="chartDom" class="summary-chart" />
</template>

<script setup>
/**
 * SummaryChart – 内存使用汇总可视化
 * @module components/SummaryChart
 */
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import * as echarts from 'echarts'
import { buildSummaryOption } from '@/core/visualization/option-generators/summary-option.js'

/**
 * 图表数据
 * @prop {Object} props  
 * @prop {Object} props.summary  内存使用汇总数据对象
 */
const props = defineProps({
  summary: { type: Object, default: null }
})

const chartDom = ref(null)
let chartInst = null

onMounted(() => {
  chartInst = echarts.init(chartDom.value)
  doRender()
})

onBeforeUnmount(() => {
  chartInst?.dispose()
  chartInst = null
})

watch(() => props.summary, () => doRender(), { immediate: false })

/**
 * 渲染或重绘图表
 * @private
 */
function doRender() {
  if (!chartInst || !props.summary) return
  const opt = buildSummaryOption(props.summary)
  chartInst.setOption(opt, true)
}

/**
 * 自适应缩放
 * @public
 */
function resize() { chartInst?.resize() }
defineExpose({ resize })
window.addEventListener('resize', resize)
onBeforeUnmount(() => window.removeEventListener('resize', resize))
</script>

<style scoped>
.summary-chart {
  flex: 0 0 220px;
  min-height: 220px;
  width: 100%;
}
</style>
