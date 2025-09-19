<template>
  <div ref="chartDom" class="summary-chart"></div>
</template>

<script setup>
import { ref, watch, onUnmounted, nextTick } from 'vue'
import * as echarts from 'echarts'
// import { isTaken } from 'echarts/types/src/component/helper/interactionMutex.js'

/* ---------------- props ---------------- */
const props = defineProps({
  summary: { type: Object, default: null }   // 单个 group {stepStatistics:[...]}
})

/* ---------------- 图表容器 ---------------- */
const chartDom = ref(null)
let chartInst = null

/* ---------------- 构造堆叠系列 ---------------- */
function bankColor(bankId, total) {
  const hue = 210;                // 蓝色系
  const saturation = 25;          // 低饱和
  const lightness = 70 - (bankId / total) * 30; // 深浅渐变
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}


function buildStackOption(summary) {
  if (!summary || !summary.stepStatistics?.length) return null

  const steps = summary.stepStatistics.map(s => s.step)

  /* 收集所有出现过的 bank id，统一顺序 */
  const bankIds = new Set()
  summary.stepStatistics.forEach(stat => {
    if (stat.bankStatistics) {
      Object.keys(stat.bankStatistics).forEach(id => bankIds.add(Number(id)))
    }
  })
  const banks = Array.from(bankIds).sort((a, b) => a - b) 

  /* 每个 bank 一个系列 */
  const series = banks.map((bankId, idx) => {
  const isTop = idx === banks.length - 1;   // 仅最上层显示总量
  return {
    name: `Bank ${bankId}`,
    type: 'bar',
    stack: 'total',
    emphasis: { focus: 'series' },
    itemStyle: {
      color: bankColor(bankId, banks.length)
    },
    ...(isTop && {
      label: {
        show: true,
        position: 'top',
        formatter: (p) => {
          const stat = summary.stepStatistics[p.dataIndex];
          return bytesToStr(stat.usedMemory);
        },
        fontSize: 11,
        color: '#333'
      }
    }),
    data: []
  };
});

  /* 填数据：每步把对应 bank 的 usedMemory 塞进去 */
  summary.stepStatistics.forEach(stat => {
    series.forEach((s, idx) => {
      const bankId = banks[idx]
      const bank = stat.bankStatistics?.[bankId]
      s.data.push(bank ? bank.usedMemory : 0)
    })
  })

  return {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
       formatter(ticks) {
        // 过滤掉值为 0 的系列
        const list = ticks
          .filter(item => item.value !== 0)
          .map(item => `${item.marker} ${item.seriesName}: <b>${bytesToStr(item.value)}</b>`)
          .join('<br/>')

        // 计算非 0 项总和
        const total = ticks
          .filter(item => item.value !== 0)
          .reduce((s, item) => s + item.value, 0)

        // 全为 0 不给悬浮框
        if (list === '') return ''

        return `Step ${ticks[0].axisValue}<br/>${list}<br/>总计: <b>${bytesToStr(total)}</b>`
      }
    },
    grid: { left: 60, right: 20, top: 30, bottom: 40 },
    xAxis: {
      type: 'category',
      data: steps,
      name: '时间步'
    },
    yAxis: {
      type: 'value',
      name: '内存占用',
      min: 0
    },
    series
  }
}


/* 工具：字节 → 人类可读 */
function bytesToStr(b) {
//   if (b === 0) return '0 B'
//   const k = 1024
//   const units = ['B', 'KB', 'MB', 'GB']
//   let i = Math.floor(Math.log(b) / Math.log(k))
//   return parseFloat((b / Math.pow(k, i)).toFixed(1)) + ' ' + units[i]
return b + ' B'
}

/* ---------------- 渲染逻辑 ---------------- */
watch(
  () => props.summary,
  async (summary) => {
    const opt = buildStackOption(summary)
    if (!opt) return          // 数据空，直接返回
    await nextTick()
    if (!chartInst) chartInst = echarts.init(chartDom.value)
    chartInst.setOption(opt, true)
  },
  { immediate: true }
)

/* ---------------- 自动 resize ---------------- */
const onResize = () => chartInst?.resize()
window.addEventListener('resize', onResize)
onUnmounted(() => {
  window.removeEventListener('resize', onResize)
  chartInst?.dispose()
})
</script>

<style scoped>
/* .summary-chart {
  width: 100%;
  height: 100%;
} */

.summary-chart {
  flex: 0 0 220px;
  min-height: 220px;   
  width: 100%;
}
</style>