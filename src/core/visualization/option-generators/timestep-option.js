import * as echarts from 'echarts';
import { createLane } from '../lanes/lane-factory';
import  BaseLane  from '../lanes/base-lane'
import { buildDeps } from '@/core/parser/dep-collector';

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

  /* ---------- 生成顶部 x 轴刻度 ---------- */
  const markLineData = BaseLane.tsTicks.map(t => ({
    xAxis: t.cycle,          // 以 cycle 坐标定位
    label: { show: false },
    lineStyle: { type: 'dashed', color: 'rgba(136, 134, 134, 0.25)', width: 1.6 }
  }));

  // const tsRightCycle = BaseLane.tsTicks.map((t, idx) => {
  //   // 最后一个 ts 的右边界 = 左边界 + 统一槽宽
  //   const width = BaseLane.tsMaxCycle.get(t.ts);
  //   return t.cycle + width;
  // });

  /* ---------- 让每条泳道自己解析出 series ---------- */
  const seriesArr = laneOrder.map((key, categoryIdx) => {
    const lane = createLane(key);
    // 把 categoryIdx 传进去，方便 parseSegments 时直接写死 value[0], 决定所属泳道
    lane.categoryIdx = categoryIdx;

    const seriesOpt = lane.toSeriesOption(logRows); // logRows: entries []
    // 确保自定义系列绑定到正确的坐标系
    if (seriesOpt.type === 'custom') {
        seriesOpt.coordinateSystem = 'cartesian2d';
        seriesOpt.xAxisIndex = 0;  // 明确绑定到第一个 xAxis
        seriesOpt.yAxisIndex = 0;  // 明确绑定到第一个 yAxis
        seriesOpt.gridIndex = 0;

        seriesOpt.emphasis = { focus: 'series' };   // 让 custom 参与 axis 采样
        seriesOpt.tooltip = true;                   // 强制打开 tooltip 开关
    }
    
    return seriesOpt;
  });
  console.log('seriesArr', {seriesArr});

  // 顶部x轴虚线挂到第一个series上
  seriesArr[0].markLine = {
    silent: true,
    animation: false,
    symbol: ['none', 'none'],
    label: { show: false },
    data: markLineData
  };

   /* ---------- 构造依赖箭头 ---------- */
  const allEntries = logRows;
  //console.log('allEntries', allEntries);
  const deps = buildDeps(allEntries, laneOrder); // [{from, to}]
  console.log('deps', deps);

  // 转成 markLine data
  const depMarkLine = deps.map(d => [
    // 起点
    {
      xAxis: (d.from.cycStart + d.from.cycEnd) / 2,
      yAxis: d.from.laneIndex,
      coordSys: 'cartesian2d'
    },
    // 终点
    {
      xAxis: (d.to.cycStart + d.to.cycEnd) / 2,
      yAxis: d.to.laneIndex,
      coordSys: 'cartesian2d'
    }
  ]);

  // 挂到任意一个 series 上（这里挂到第一条）
  seriesArr[1].markLine = {
    silent: true,
    animation: false,
    symbol: ['none', 'arrow'], // 末端箭头
    lineStyle: { color: '#5844d6ff', width: 1.5, type: 'dashed' },
    label: { show: false },
    data: [
      //...markLineData,  // 原有顶部虚线
      ...depMarkLine     // 新增依赖箭头
    ]
  };

  // /* 预先建一张 “整数 → ts” 表，并记录刻度间距 */
  // const cycleTicks = BaseLane.tsTicks.map(t => t.cycle);
  // const cycle2ts   = new Map(BaseLane.tsTicks.map(t => [t.cycle, t.ts]));
  // /* 二分查找：把任意浮点 cycle 映射到最近的真实刻度 */
  // function findClosestCycle(c) {
  //   let l = 0, r = cycleTicks.length - 1;
  //   while (l < r) {
  //     const m = Math.floor((l + r) / 2);
  //     if (cycleTicks[m] < c) l = m + 1;
  //     else r = m;
  //   }
  //   /* 比较左右两个相邻刻度，取更近的那个 */
  //   if (l > 0 && Math.abs(cycleTicks[l-1] - c) < Math.abs(cycleTicks[l] - c)) l--;
  //   return cycleTicks[l];
  // }

  /* ---------- 区域缩放、复位、导出 ---------- */
  const toolbox = {
    show: true,
    right: 20,          // 距离右侧
    top: -5,             // 距离顶部
    feature: {
      /* 1. 区域缩放 */
      dataZoom: {
        title: {
          zoom: '区域缩放',
          back: '缩放还原'
        },
        iconStyle: {
          borderColor: '#666'
        }
      },
      /* 2. 一键还原所有 dataZoom */
      restore: {
        title: '复位',
        iconStyle: {
          borderColor: '#666'
        }
      },
      /* 3. 保存为图片 */
      saveAsImage: {
        title: '导出图片',
        iconStyle: {
          borderColor: '#666'
        },
        pixelRatio: 2,           // 高清
        backgroundColor: '#fff'
      }
    },
    emphasis: {               // 鼠标悬停样式
      iconStyle: {
        textFill: '#000'
      }
    }
  };


  /* ---------- 3. 搭好全局骨架 ---------- */
  const option = {
    animation: true,
    backgroundColor: 'transparent',
    tooltip: {
      /* 1. 用 item 保证矩形一定能触发 */
      trigger: 'item',
      /* 2. 继续保留十字准星 */
      axisPointer: {
        type: 'cross',
        animation: false,
        label: {
          formatter(obj) {
            const { axisDimension, axisIndex, value } = obj;
            if (axisDimension === 'x' && axisIndex === 0) return `${value} cycle`;
            if (axisDimension === 'x' && axisIndex === 1) return `ts-${value}`;
            if (axisDimension === 'y' && axisIndex === 0) return String(value);
            return '';
          },
          position(pos, params, dom, rect, size) { 
          const [x, y] = pos;
            const { axisDimension } = params;
            const { contentSize } = size;
            if (axisDimension === 'x') {
              return [x - contentSize[0] / 2, 10]; // 贴顶
            }
            if (axisDimension === 'y') {
              return [10, y - contentSize[1] / 2]; // 贴左
            }
            return [x, y];
          },
          backgroundColor: 'rgba(50,50,50,0.7)',
          color: '#fff',
          fontSize: 12,
          // padding: [2, 4]
        }
      },
      appendToBody: true,
      formatter(p) {
        /* 现在 p 就是单个矩形的数据 */
        const s = p.data.raw;
        return `
          ${p.marker}${p.name}<br/>
          ts:&nbsp;${s.raw.timestep}<br/>
          start:&nbsp;${s.cycStart} cycle<br/>
          end:&nbsp;${s.cycEnd} cycle<br/>
          duration:&nbsp;${s.duration} cycle<br/>
          concerning_op:&nbsp;${s.raw.concerning_op}<br/>
          concerning_op_name:&nbsp;${s.raw.concerning_op_name}
        `;
      }
    },
    dataZoom: [
      {
        type: 'slider',
        xAxisIndex: [0,1],
        filterMode: 'weakFilter',
        showDataShadow: false,
        height: 20,
        bottom: 10,
        labelFormatter: ''
      },
      { type: 'inside', filterMode: 'weakFilter', xAxisIndex:  [0,1], }
    ],
    grid: [
      {
        left: 120,
        right: 40,
        top: 60,
        bottom: 40,
        height: yCategories.length * 150 + 60   // 动态算高度
      }
    ],
    xAxis: [
      // cycle 主轴
      {
        type: 'value',//time',
        min: 0,                              // 轴起点
        max: BaseLane.globalRightEdge || 100, // 轴终点（cycle 总长）
        axisLine: { show: true },
        axisLabel: {
            formatter: val => `${val} cycle`
        }
      },
      // ts 副轴
      {
        type: 'category',
        position: 'top',           // 放在矩形上方
        boundaryGap: false,        // 刻度紧挨
        axisLine: { show: false, lineStyle: { type: 'dashed' } },
        axisTick: { alignWithLabel: false, length: 4 },
        axisLabel: { fontSize: 11, color: '#666', 
          // formatter: val => {
          //   const closest = findClosestCycle(val);
          //   return cycle2ts.get(closest) ?? '';
          // }
         }, 
        data: BaseLane.tsTicks.map(t => t.ts),   // 刻度文字 = ts
        axisPointer: {
          type: 'line',
          lineStyle: { color: 'transparent' } // <── 隐藏指示线
        }
      }
   ],
    yAxis: [
      {
      type: 'category',
      data: yCategories,
      axisLine: { show: true },
      axisTick: { show: true },
      axisLabel: { fontSize: 12 }
      }
   ],
    series: seriesArr,
    toolbox,
  };

  /* ---------- 4. 主题合并（如果主题已注册） ---------- */
  if (echarts.getMap(themeName)) {
    return echarts.util.merge(option, echarts.getMap(themeName));
  }
  //console.log('>>> 最终 option', JSON.stringify(option, null, 2));
  return option;
}