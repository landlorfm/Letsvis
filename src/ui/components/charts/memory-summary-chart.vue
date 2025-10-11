<template>
  <div ref="chartDom" class="summary-chart" />
</template>

<script setup>
import { ref, watch, onUnmounted, nextTick } from 'vue'
import * as echarts from 'echarts'
import { buildSummaryOption } from '@/core/visualization/option-generators/summary-option.js'

const props = defineProps({
  summary: { type: Object, default: null }
})

const chartDom = ref(null)
let chartInst = null

/* ------- 渲染 ------- */
watch(
  () => props.summary,
  async (summary) => {
    const opt = buildSummaryOption(summary)
    if (!opt) return
    await nextTick()
    if (!chartInst) chartInst = echarts.init(chartDom.value)
    chartInst.setOption(opt, true)
  },
  { immediate: true }
)

/* ------- 自适应 ------- */
const onResize = () => chartInst?.resize()
window.addEventListener('resize', onResize)
onUnmounted(() => {
  window.removeEventListener('resize', onResize)
  chartInst?.dispose()
})
</script>

<style scoped>
.summary-chart {
  flex: 0 0 220px;
  min-height: 220px;
  width: 100%;
}
</style>