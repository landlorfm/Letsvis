import * as echarts from 'echarts';
import { createLane } from '../lanes/lane-factory';

const CYCLE_TO_MS = 1e-6; // 1 cycle = 1 μs = 0.001 ms

/* ---------- 主函数 ---------- */
export function genProfileOption({
  profileData,
  laneOrder,
  visibleKeys = null,
}) {
  if (!profileData?.length) {
    return { title: { text: 'No Profile Data', left: 'center' } }
  }
//    console.log('【Chart】入参', { profileData, laneOrder, visibleKeys })

  const { settings = {}, entries: rawEntries = [] } = profileData[0]
  const totalCycle = settings.totalCycle || Math.max(...rawEntries.map(e => e.start + e.cost), 0)
  const PAD = totalCycle * 0.0 // 30% 额外空间, 缩放渲染不吞矩形

  /* 1. 掩码过滤（同 timestep） */
  //console.log('visibleKeys', visibleKeys);
//   console.log('drawingRows', drawingRows);

  const drawingRows = rawEntries.filter(e => visibleKeys.has(`${e.op}-${e.type}-${e.start}`))
  console.log('drawingRows', drawingRows);

  /* 2. 用 laneOrder + 工厂 创建泳道（对标 timestep） */
  const yCategories = []
  const lanes = []
  laneOrder.forEach((key, idx) => {
    const lane = createLane(key)
    lane.categoryIdx = idx
    yCategories.push(lane.laneName)
    lanes.push(lane)
  })

  /* 3. 生成 series + 动态 legend */
  let seriesArr = []
  // const legendData = []
  lanes.forEach(lane => {
    const seriesOpt = lane.toSeriesOption(drawingRows)
    seriesOpt.id = `profile-custom-click-${lane.laneName}`;  // 与监听同名
    seriesOpt.silent = false;                 // 关键：允许事件
    // if (seriesOpt.data && seriesOpt.data.length) {
    //   legendData.push(lane.laneName)
    // }
    seriesArr.push(seriesOpt)
  })
  seriesArr = seriesArr.filter(
  s => !(s.type === 'custom' && (!s.data || s.data.length === 0))
  )

  /* 4. 全程无数据兜底 */
  // if (!legendData.length) {
  //   return {
  //     title: { text: '暂无数据', left: 'center', top: '40%' },
  //     series: []
  //   }
  // }


  /* 5. 依赖箭头（预留空数组，后续接 dep-collector） */
  const depMarks = []; // TODO: 同 timestep 调用 buildDeps 后生成

  /* 6. 系列挂 markLine */
  if (seriesArr[0]) {
    seriesArr[0].markLine = {
      silent: true,
      animation: false,
      symbol: ['none'],
      data: [ ...depMarks],
      label: { fontSize: 11, position: 'end' }
    };
  }

  /* ----- 7. 统计：每条泳道可见矩形条数 + 总 cycle ----- */
  const stats = yCategories.reduce((acc, name) => {
    acc[name] = { count: 0, totalCycles: 0 }; return acc
  }, {})

  seriesArr.forEach(s => {
    if (s.type === 'custom' && s.data) {
      const laneName = s.name
      stats[laneName].count = s.data.length
      stats[laneName].totalCycles = s.data.reduce((sum, d) => sum + (d.raw?.duration || 0), 0)
    }
  })

  /* 8. 构造 option */
  const gridHeight = yCategories.length * 80 + 60;
   /* 十字准心 + 轴标签悬停  */
  const fmtAxisMs = (v) => (v * CYCLE_TO_MS).toFixed(3) + ' ms';
  
  return {
    animation: true,
    backgroundColor: '#fff',
    grid: { left: 100, right: 40, top: 80, bottom: 80, height: gridHeight },
    // legend: {
    //   data: legendData,
    //   top: 10,
    //   left: 'center'
    // },
    tooltip: {
        trigger: 'item',
        axisPointer: {
        type: 'cross',
        animation: false,
        label: {
            formatter(obj) {
            const { axisDimension, value } = obj;
            if (axisDimension === 'x') return fmtAxisMs(value);
            if (axisDimension === 'y') return String(value);
            return '';
            },
            position(pos, params, dom, rect, size) {
            const [x, y] = pos;
            const { axisDimension } = params;
            const { contentSize } = size;
            if (axisDimension === 'x') return [x - contentSize[0] / 2, 10]; // 贴顶
            if (axisDimension === 'y') return [10, y - contentSize[1] / 2]; // 贴左
            return [x, y];
            },
            backgroundColor: 'rgba(50,50,50,0.7)',
            color: '#fff',
            fontSize: 12
        }
        },
        appendToBody: true,
        formatter(p) {
        const s = p.data?.raw;
        if (!s) return '';
        const startMs = (s.cycStart * CYCLE_TO_MS);//.toFixed(3);
        const endMs = (s.cycEnd * CYCLE_TO_MS);//.toFixed(3);
        const durMs = (s.duration * CYCLE_TO_MS).toFixed(6);
        return `
            ${p.marker}${p.name}<br/>
            start: ${startMs} ms<br/>
            end: ${endMs} ms<br/>
            duration: ${durMs} ms<br/>
            ${s.bd_id != null ? `bd_id: ${s.bd_id}<br/>` : ''}
            ${s.gdma_id != null ? `gdma_id: ${s.gdma_id}<br/>` : ''}
            ${s.direction != null ? `direction: ${s.direction}<br/>` : ''}
            ${s.size != null ? `size: ${s.size}<br/>` : ''}
            ${s.bandwidth != null ? `bandwidth: ${s.bandwidth.toFixed(2)}<br/>` : ''}
        `;
        }
    },
    toolbox: {
      right: 20,
      top: 10,
      feature: {
        dataZoom: { title: { zoom: '区域缩放', back: '缩放还原' } },
        restore: { title: '复位' },
        saveAsImage: { title: '导出图片', pixelRatio: 2 }
      }
    },
    dataZoom: [
      { type: 'slider', xAxisIndex: 0, filterMode: 'weakFilter', bottom: 20, height: 20 },
      { type: 'inside', xAxisIndex: 0, filterMode: 'weakFilter' }
    ],
    xAxis: {
      type: 'value',
      min: 0,
      max: totalCycle + PAD,
      name: 'ms',
        axisLabel: {
            formatter: (v) => (v * CYCLE_TO_MS).toFixed(3) + ' ms'
        },
      axisLine: { show: true }
    },
    yAxis: {
      type: 'category',
      data: yCategories,
      axisLine: { show: true },
      axisTick: { alignWithLabel: true },
      axisPointer: {
        type: 'line',
        label: {
          show: true,
          formatter({ value }) {
            const { count, totalCycles } = stats[value] || { count: 0, totalCycles: 0 }
            const totalMs = (totalCycles * CYCLE_TO_MS).toFixed(3)
            return `${value}\ncounts=${count}\ntotal=${totalMs} ms`
          },
        },
        backgroundColor: 'rgba(50,50,50,0.9)',
        color: '#fff',
        fontSize: 12,
        padding: [4, 6],
        borderRadius: 3
      },
    },
    series: seriesArr
  };
}