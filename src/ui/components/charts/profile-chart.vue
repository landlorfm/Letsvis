<template>
  <div ref="chartDom" class="profile-chart-box"></div>
</template>

<script setup>
import * as echarts from 'echarts'
import { ref, watch, onMounted, onBeforeUnmount, computed } from 'vue'
import { genProfileOption, createProfileDataAccessor } from '@/core/visualization/option-generators/profile-option'


/* -------- props -------- */
const props = defineProps({
  data: { type: Object, default: null },          // {entries:[], settings:{}}
  visibleKeys: { type: Set, default: () => new Set() },   // 预留过滤掩码
})

/* -------- DOM & 实例 -------- */
const chartDom = ref(null)
let chartInst = null
const dataAccessor = ref(null) 


/* -------- 计算属性：option -------- */
const chartOption = computed(() => {
  // if (!props.data?.entries?.length) return {}
  if(!props.data) return {}

  dataAccessor.value = createProfileDataAccessor(props.data);

  console.log('chart Data', [props.data]);
  return genProfileOption({
    profileData: [props.data],       
    laneOrder: ['profile-bd', 'profile-gdma'],
    visibleKeys: props.visibleKeys, 
    chartInst,
    dataAccessor: dataAccessor.value
  })
})

/* -------- 生命周期 -------- */
onMounted(() => {
  //chartInst = echarts.init(chartDom.value)   // 不传主题
  if (!chartInst) chartInst = echarts.init(chartDom.value)
  else chartInst.clear()          // 清数据但保留实例
  watch(chartOption, (opt) => {
    // if (!opt || !opt.series || opt.series.length === 0) return // ← 兜底，不给空 [过滤可能导致空情况] 
    chartInst.setOption(opt, { replaceMerge: ['grid', 'xAxis', 'yAxis', 'series'], lazyUpdate: true, notMerge: false  })  //
  }, { deep: true }) //immediate: true 


  // /* 监听处理点击事件， 点击放大 */
  // chartInst.on('click', /^profile-custom-click-/, (params) => {
  //   // console.log('>>> click event', params);
  //   if (params.dataIndex == null) return;
  //   const raw = chartInst.getOption().series[params.seriesIndex].data[params.dataIndex].raw;
  //   if (!raw) return;
  //   const pad = Math.max(1, (raw.cycEnd - raw.cycStart) * 0.1);
  //   chartInst.dispatchAction({
  //     type: 'dataZoom',
  //     startValue: raw.cycStart - pad,
  //     endValue:   raw.cycEnd   + pad,
  //     xAxisIndex: [1, 0]
  //   });
  // });

  /* 监听处理点击事件，点击放大 */
  chartInst.on('click', /^profile-custom-click-/, (params) => {
    // console.log('>>> click event', params);
    if (params.dataIndex == null) return;
    
    // 获取系列数据
    const seriesData = chartInst.getOption().series[params.seriesIndex].data;
    if (!seriesData || !seriesData[params.dataIndex]) return;
    
    // 从 _ref 获取数据引用
    const ref = seriesData[params.dataIndex].raw;
    if (!ref) return;
    
    // 通过数据访问器获取完整数据
    const entry = dataAccessor.value.getEntryByRef(ref);
    if (!entry) return;
    
    // 从value数组获取坐标信息
    const value = seriesData[params.dataIndex].value;
    if (!value || value.length < 4) return;
    
    const cycStart = value[1]; // 第2维是起始cycle
    const cycEnd = value[2];   // 第3维是结束cycle
    
    const pad = Math.max(1, (cycEnd - cycStart) * 0.1);
    chartInst.dispatchAction({
      type: 'dataZoom',
      startValue: cycStart - pad,
      endValue: cycEnd + pad,
      xAxisIndex: 0  // 只作用于主x轴
    });
  });


  chartInst.on('restore', () => {
    const freshOption = genProfileOption({
      profileData: [props.data],       
      laneOrder: ['profile-bd', 'profile-gdma'],
      visibleKeys: props.visibleKeys,
      chartInst,
      dataAccessor: dataAccessor.value
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