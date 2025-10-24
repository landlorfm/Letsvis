<template>
  <div ref="chartDom" class="profile-chart-box"></div>
</template>

<script setup>
/**
 * ProfileChart – 性能分析可视化
 * @module components/ProfileChart
 */
import * as echarts from 'echarts'
import { ref, watch, onMounted, onBeforeUnmount, computed } from 'vue'
import { genProfileOption } from '@/core/visualization/option-generators/profile-option'

/* -------- props -------- */
/**
 * 图表数据
 * @prop {Object} props  
 * @prop {Object} props.data          性能分析数据对象 {entries: [], settings: {}}
 * @prop {Set}    props.visibleKeys   可见数据键集合（过滤用) 当前未使用
 */
const props = defineProps({
  data: { type: Object, default: null },          // {entries:[], settings:{}}
  visibleKeys: { type: Set, default: () => new Set() },   // 预留过滤掩码
})

/* -------- DOM & 实例 -------- */
const chartDom = ref(null)
let chartInst = null

/* -------- 计算属性：option -------- */
const chartOption = computed(() => {
  if (!props.data?.entries?.length) return {}
//   return genProfileOption([props.data])   // 包装成 [{settings, entries}] 格式
  // console.log('chart Data', [props.data]);
  return genProfileOption({
    profileData: [props.data],       
    laneOrder: ['profile-bd', 'profile-gdma', 'profile-layer'],
    visibleKeys: props.visibleKeys, 
    chartInst
  })
})

/* -------- 生命周期 -------- */
onMounted(() => {
  // await nextTick()
  if (!chartInst) chartInst = echarts.init(chartDom.value)
  else chartInst.clear()          // 清数据但保留实例

  watch(chartOption, (opt) => {
    // if (!opt || !opt.series || opt.series.length === 0) return // ← 兜底，不给空 [过滤可能导致空情况] 
    chartInst.setOption(opt, { replaceMerge: ['grid', 'xAxis', 'yAxis', 'series']  })  //, lazyUpdate: true, notMerge: false
  }, {deep: true }) //immediate: true deep: true 


  /* 监听处理点击事件， 点击放大 */
  chartInst.on('click', /^profile-custom-click-/, (params) => {
    // console.log('>>> click event', params);
    if (params.dataIndex == null) return;
    const raw = chartInst.getOption().series[params.seriesIndex].data[params.dataIndex].raw;
    if (!raw) return;
    const pad = Math.max(1, (raw.cycEnd - raw.cycStart) * 0.1);
    chartInst.dispatchAction({
      type: 'dataZoom',
      startValue: raw.cycStart - pad,
      endValue:   raw.cycEnd   + pad,
      xAxisIndex: [1, 0]
    });
  });


  chartInst.on('restore', () => {
    const freshOption = genProfileOption({
      profileData: [props.data],       
      laneOrder: ['profile-bd', 'profile-gdma', 'profile-layer'],
      visibleKeys: props.visibleKeys,
      chartInst
    })
    chartInst.setOption(freshOption, { replaceMerge: 'series', lazyUpdate: true  }) // replace: true
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
.profile-chart-box {
  width: 100%;
  height: 100%;
}
</style>