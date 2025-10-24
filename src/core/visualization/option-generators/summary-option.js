const MIN_COLOR_LIGHT = 40
const MAX_COLOR_LIGHT = 70
const HUE_BLUE = 210  // 蓝色系
const SATURATION = 25  // 低饱和
/**
 * 生成bank颜色
 * @param {number} bankId 
 * @param {number} total bank总数
 * @returns {string} HSL
 */
function bankColor(bankId, total) {
  const lightness = MAX_COLOR_LIGHT - (bankId / total) * (MAX_COLOR_LIGHT - MIN_COLOR_LIGHT)  // 随bank号增大变深
  return `hsl(${HUE_BLUE}, ${SATURATION}%, ${lightness}%)`
}

/**
 * 生成汇总图表的配置选项
 * @param {Object} summary 
 * @returns {Object|null} 
 */
export function buildSummaryOption(summary) {
  if (!summary?.stepStatistics?.length) return null

  const steps = summary.stepStatistics.map(s => s.step)

  /* ---------- 收集 bank ---------- */
  const bankIds = new Set()
    // 收集所有出现过的 bank id，统一顺序 
  summary.stepStatistics.forEach(stat => {
    Object.keys(stat.bankStatistics || {}).forEach(id => bankIds.add(Number(id)))
  })
  const banks = Array.from(bankIds).sort((a, b) => a - b)

  /* ---------- 构造系列 ---------- */
  const series = banks.map((bankId, idx) => {
    const isTop = idx === banks.length - 1   // 仅最上层显示总量
    return {
      name: `bank ${bankId}`,
      type: 'bar',
      stack: 'total',
      emphasis: { focus: 'series' },
      itemStyle: { color: bankColor(bankId, banks.length) },
      ...(isTop && {
        label: {
          show: true,
          position: 'top',
          formatter: ({ dataIndex }) => bytesToStr(summary.stepStatistics[dataIndex].usedMemory),
          fontSize: 11,
          color: '#333'
        }
      }),
      data: []
    }
  })

  /* ---------- 填数据, 每步把对应 bank 的 usedMemory 塞进去 ---------- */
  summary.stepStatistics.forEach(stat => {
    series.forEach((s, idx) => {
      const bankId = banks[idx]
      s.data.push(stat.bankStatistics?.[bankId]?.usedMemory || 0)
    })
  })

  return {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter(ticks) {
        const list = ticks
          .filter(item => item.value !== 0)  // 过滤掉值为 0 的系列
          .map(item => `${item.marker} ${item.seriesName}: <b>${bytesToStr(item.value)}</b>`)
          .join('<br/>')
        const total = ticks
          .filter(item => item.value !== 0)
          .reduce((s, n) => s + n.value, 0)
        return list ? `Step ${ticks[0].axisValue}<br/>${list}<br/>总计: <b>${bytesToStr(total)}</b>` : ''  // 全为 0 不给悬浮框
      }
    },
    grid: { left: 60, right: 20, top: 30, bottom: 40 },
    xAxis: { type: 'category', data: steps, name: '时间步' },
    yAxis: { type: 'value', name: '内存占用', min: 0 },
    series
  }
}

function bytesToStr(b) {
//   if (b === 0) return '0 B'
//   const k = 1024
//   const units = ['B', 'KB', 'MB', 'GB']
//   let i = Math.floor(Math.log(b) / Math.log(k))
//   return parseFloat((b / Math.pow(k, i)).toFixed(1)) + ' ' + units[i]
return b + ' B'
}