import { formatMemoryValue } from '@/utils/color-utils.js';   // 你已有

/**
 * 将后端解析出的单组 summary 数据转成 ECharts option
 * @param {Object} groupItem  – groups[ i ] 元素
 * @param {Object} globalSummary – summary.globalSummary
 * @returns {Object} ECharts option
 */
export function buildSummaryOption(groupItem, globalSummary) {
  const stepArr = groupItem.stepStatistics;
  if (!stepArr || !stepArr.length) return { series: [] };

  // 1. 数据序列
  const barSeries = {
    name: 'Used Memory',
    type: 'bar',
    barWidth: '60%',
    data: stepArr.map(s => [s.step, s.usedMemory]),
    itemStyle: {
      color: 'rgba(174, 199, 232, 1)'   // 与原 barColor 一致
    },
    label: {
      show: true,
      position: 'top',
      formatter: p => formatMemoryValue(p.value[1]),
      fontSize: 10
    }
  };

  // 2. 全局最大内存横线
  const markLine = {
    silent: true,
    symbol: 'none',
    lineStyle: { color: '#d9534f', type: 'dashed', width: 1 },
    data: [{ yAxis: globalSummary.maxMemoryUsage, label: { formatter: 'Global Max' } }]
  };

  // 3. 组装 option
  return {
    grid: { left: 70, right: 30, top: 30, bottom: 50 },
    xAxis: {
      name: 'Step',
      type: 'category',
      axisTick: { alignWithLabel: true },
      data: stepArr.map(s => String(s.step))
    },
    yAxis: {
      name: 'Memory',
      type: 'value',
      axisLabel: { formatter: v => formatMemoryValue(v) }
    },
    series: [{ ...barSeries, markLine }]
  };
}