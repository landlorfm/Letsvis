import * as echarts from 'echarts';
import { createLane } from '../lanes/lane-factory';
import  BaseLane  from '../lanes/base-lane'

/**
 * @param {Object} opts
 * @param {Array<Object>} opts.logRows          原始日志行
 * @param {string[]}        opts.laneOrder      要出现的泳道 key，按上下顺序
 * @param {string}          opts.themeName      已在 echarts-manager 里注册的主题名
 */
export function buildTimeStepOption({
  logRows,
  laneOrder,
  themeName = 'light',
}) {
  BaseLane.buildGlobalTimeAxis(logRows);

  /* ---------- 1. 生成 y 轴类目 ---------- */
  const yCategories = laneOrder.map(key => {
    const lane = createLane(key);   // 仅借用它读 laneName
    return lane.laneName;
  });

  /* ---------- 2. 让每条泳道自己解析出 series ---------- */
  const seriesArr = laneOrder.map((key, categoryIdx) => {
    const lane = createLane(key);
    // 把 categoryIdx 传进去，方便 parseSegments 时直接写死 value[0], 决定所属泳道
    lane.categoryIdx = categoryIdx;
    //return lane.toSeriesOption(logRows);

    const seriesOpt = lane.toSeriesOption(logRows); // logRows: entries []
   
      // 确保自定义系列绑定到正确的坐标系
    if (seriesOpt.type === 'custom') {
        seriesOpt.coordinateSystem = 'cartesian2d';
        seriesOpt.xAxisIndex = 0;  // 明确绑定到第一个 xAxis
        seriesOpt.yAxisIndex = 0;  // 明确绑定到第一个 yAxis
        seriesOpt.gridIndex = 0;
    }
    
    return seriesOpt;
  });
  console.log('seriesArr', {seriesArr});


  /* ---------- 3. 搭好全局骨架 ---------- */
  const option = {
    animation: true,
    backgroundColor: 'transparent',
    tooltip: {
        trigger: 'item',
        appendToBody: true,
        formatter: (p) => {
            // p.data 就是 base-lane 里挂的 {value, name, raw, ...}
            const s = p.data.raw;
            return `
            ${p.marker}${p.name}<br/>
            ts:&nbsp;${s.raw.timestep}&nbsp;<br/>
            start:&nbsp;${s.cycStart}&nbsp;cycle<br/>
            end:&nbsp;${s.cycEnd}&nbsp;cycle<br/>
            duration:&nbsp;${s.duration}&nbsp;cycle<br/>
            concerning_op:&nbsp;${s.raw.concerning_op}<br/>
            concerning_op_name:&nbsp;${s.raw.concerning_op_name}
            `;
        }
    },
    dataZoom: [
      {
        type: 'slider',
        xAxisIndex: 0,
        filterMode: 'weakFilter',
        showDataShadow: false,
        height: 20,
        bottom: 10,
        labelFormatter: ''
      },
      { type: 'inside', filterMode: 'weakFilter', xAxisIndex: 0, }
    ],
    grid: [
      {
        left: 120,
        right: 40,
        top: 40,
        bottom: 60,
        // height: yCategories.length * 40 + 60   // 动态算高度
      }
    ],
    xAxis: [
      {
        type: 'value',//time',
        min: 0,                              // 轴起点
        max: BaseLane.globalRightEdge || 100, // 轴终点（cycle 总长）
        axisLabel: {
            formatter: val => `${val} cycle`
        }
      }
   ],
    yAxis: [
      {
      type: 'category',
      data: yCategories,
      axisLine: { show: true },
      axisTick: { show: false },
      axisLabel: { fontSize: 12 }
      }
   ],
    series: seriesArr
  };

  /* ---------- 4. 主题合并（如果主题已注册） ---------- */
  if (echarts.getMap(themeName)) {
    return echarts.util.merge(option, echarts.getMap(themeName));
  }
  //console.log('>>> 最终 option', JSON.stringify(option, null, 2));
  return option;
}