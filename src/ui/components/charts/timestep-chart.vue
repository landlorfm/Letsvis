<template>
  <div ref="chartDom" class="ts-chart-box"></div>
</template>


<script setup>
import * as echarts from 'echarts'
import { ref, watch, onMounted, onBeforeUnmount, nextTick, computed } from 'vue'
import { buildTimeStepOption } from '@/core/visualization/option-generators/timestep-option'

/* -------- props -------- */
const props = defineProps({
  data: { type: Object, default: null },   // {entries:[], settings:{}}
  settings: { type: Object, default: null },
  visibleKeys: { type: Set, default:  () => new Set() }   
})

/* -------- DOM & 实例 -------- */
const chartDom = ref(null)      // 容器
let chartInst = null            // ECharts 实例

/* -------- 计算属性：option -------- */
const chartOption = computed(() => {
  if (!props.data?.entries?.length) return {}

  return buildTimeStepOption({
    logRows: props.data.entries,
    laneOrder: ['gdma', 'layer'],
    themeName: 'light',
    visibleKeys: props.visibleKeys // 传入过滤掩码
  })
})


/* -------- 生命周期 -------- */
onMounted(() => {
  chartInst = echarts.init(chartDom.value, 'light')   // 主题名按需要
  // 关键：监听数据变化
  watch(chartOption, (opt) => {
    chartInst.setOption(opt, { replaceMerge: ['grid', 'xAxis', 'yAxis', 'series'] })
  }, { immediate: true })

  // 调试打印
  // nextTick(() => {
  //   console.log('>>> 初始 option', chartInst.getOption())
  // })

  chartInst.on('restore', () => {
    const freshOption = buildTimeStepOption({
      logRows: props.data.entries,
      laneOrder: ['gdma', 'layer'],
      themeName: 'light',
    })
    chartInst.setOption(freshOption, { replace: true })
  })
})

onBeforeUnmount(() => {
  chartInst?.dispose()
})


/* -------- 供父组件手动调用 -------- */
function resize() {
  chartInst?.resize()
}
defineExpose({ resize })
</script>

<style scoped>
.ts-chart-box {
  width: 100%;
  height: 100%;
}

</style>