import * as echarts from 'echarts';
import { createLane } from '../lanes/lane-factory';
import  BaseLane  from '../lanes/base-lane'
import { buildDeps } from '@/core/parser/dep-collector';

/**
 * @param {Object} opts
 * @param {Array<Object>} opts.logRows          输入日志行
 * @param {string[]}        opts.laneOrder      要出现的泳道 key，按上下顺序
 * @param {string}          opts.themeName      已在 echarts-manager 里注册的主题名
 */
export function buildTimeStepOption({
  logRows,
  laneOrder,
  themeName = 'light',
  visibleKeys = null,  // 新增
  chartInst = null    // 新增，传入图表实例以便 dispatchAction
}) {
  
  /* ---------- 全局预扫描，生成静态蓝图 ---------- */
  BaseLane.buildGlobalTimeAxis(logRows);

    const drawingRows = visibleKeys?.size
    ? logRows.filter(e => visibleKeys.has(`${e.timestep}-${e.op}-${e.tensor_name}`))
    : logRows
    //console.log('drawingRows', drawingRows);

  /* ---------- 生成 y 轴类目 ---------- */
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

  /*  槽位中点 */
  const tsLabels = BaseLane.tsTicks.map(({ ts }) => {
    const w  = BaseLane.tsMaxCycle.get(ts) || 1;
    const left = BaseLane.tsLeftEdge.get(ts);
    return { ts, cycle: left + w / 2 };
  });
  // markline 标签数据，保证同步缩放且完整显示
  const tsLabelMarkLine = tsLabels.map(({ ts, cycle }) => ({
    xAxis: cycle,                // 固定在槽位中点
    label: {
      show: true,
      position: 'end',        // 垂直居中
      formatter: `ts${ts}`,
      fontSize: 11,
      color: '#666',
     // backgroundColor: 'rgba(255,255,255,0.8)',
      padding: [2, 4],
      borderRadius: 2
    },
    lineStyle: { opacity: 1,  color: 'transparent'  },   // 只保留文字，线置透明
    symbol: 'none',
    z:10
  }));
  //console.log('tsLabelMarkLine', tsLabelMarkLine);

  /*  预建 [左边界, 右边界) → ts 表，用于十字准心轴标签显示 */
  const tsRanges = BaseLane.tsTicks.map(({ ts }) => {
      const left = BaseLane.tsLeftEdge.get(ts);
      const w    = BaseLane.tsMaxCycle.get(ts) || 1;
      return { ts, left, right: left + w };
    }).sort((a, b) => a.left - b.left);   // 按左边界升序
  const findTsStrict = (cycle) => {
    let l = 0, r = tsRanges.length - 1;
    while (l <= r) {
      const m = (l + r) >> 1;
      const { left, right, ts } = tsRanges[m];
      if (cycle >= left && cycle < right) return ts;   // 半开区间 [left, right)
      if (cycle < left) r = m - 1;
      else l = m + 1;
    }
    // 落在最左/最右外侧时，按边界归拢
    if (cycle <= tsRanges[0].left) return tsRanges[0].ts;
    if (cycle >= tsRanges[tsRanges.length - 1].right) return tsRanges[tsRanges.length - 1].ts;
    return null; // 理论上不会走到
  };


  /* ---------- 让每条泳道自己解析出 series ---------- */
  let seriesArr = laneOrder.map((key, categoryIdx) => {
    const lane = createLane(key);
    // 把 categoryIdx 传进去，方便 parseSegments 时直接写死 value[0], 决定所属泳道
    lane.categoryIdx = categoryIdx;

    const seriesOpt = lane.toSeriesOption(drawingRows); // logRows: entries []
    seriesOpt.id = `timestep-custom-click-${key}`;  // 与监听同名
    seriesOpt.silent = false;                 // 关键：允许事件
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
  seriesArr = seriesArr.filter(
  s => !(s.type === 'custom' && (!s.data || s.data.length === 0))
)
  console.log('seriesArr', {seriesArr});

  /* ----- 统计：各泳道可见矩形条数 + 总 cycle ----- */
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


  // 顶部x轴虚线和标签挂到第一个series上
  if(seriesArr[0]){
    seriesArr[0].markLine = {
    silent: true,
    animation: false,
    symbol: ['none'],
    label: { show: true },
    // data: markLineData
     data: [
      ...markLineData,      // 原来的竖直虚线
      ...tsLabelMarkLine    // 新增文本标签
    ]
  };

  }
// console.log('markLine data', seriesArr[0].markLine.data);

   /* ---------- 构造依赖箭头 ---------- */
  const allEntries = drawingRows;
  //console.log('allEntries', allEntries);
  const deps = buildDeps(allEntries, laneOrder); // [{from, to}]
  // console.log('deps', deps);

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
  if(seriesArr[1]){
    seriesArr[1].markLine = {
    silent: true,
    animation: false,
    symbol: ['none', 'arrow'], // 末端箭头
    lineStyle: { color: '#5844d6ff', width: 1.5, type: 'dashed' },
    label: { show: false },
    data: [
      ...depMarkLine     // 新增依赖箭头
    ]
  };

  }

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
            if (axisDimension === 'x' && axisIndex === 1) {
              // 顶部轴：用当前 cycle 反查最近 ts
              const ts = findTsStrict(value);
              return `ts${ts}`;
            }
            if (axisDimension === 'y' && axisIndex === 0) return `${String(value)}`;
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
        if(p === null) return '';
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
        bottom: 40,
        labelFormatter: ''
      },
      { type: 'inside', filterMode: 'weakFilter', xAxisIndex:  [0,1], }
    ],
    grid: [
      {
        left: 100,
        right: 40,
        top: 60,
        bottom: 15,
        height: yCategories.length * 100 + 60   // 动态算高度
      }
    ],
    xAxis: [
      // cycle 主轴
      {
        type: 'value',// time',
        min: 0,                              // 轴起点
        max: BaseLane.globalRightEdge || 100, // 轴终点（cycle 总长）
        axisLine: { show: true },
        axisLabel: {
            formatter: val => `${val} cycle`
        }
      },
      // ts 副轴
      {
        type: 'value',
        position: 'top',
        min: 0,
        max: BaseLane.globalRightEdge,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { show: false },   // 文字已交给 markLine
        axisPointer: {
          type: 'line',
          lineStyle: { color: 'transparent' }, // 只留十字准星
          label: {
            formatter(obj) {
              /* 用当前 cycle 反查最近 ts */
              const ts = findTsStrict(obj.value);
              return `ts${ts}`;
            },
            backgroundColor: 'rgba(50,50,50,0.7)',
            color: '#fff',
            fontSize: 12
          }
        },
      }
   ],
    yAxis: [
      {
        type: 'category',
        data: yCategories,
        axisLine: { show: true },
        axisTick: { 
          show: true,
          length: 4,
          alignWithLabel: true
        },
        axisLabel: { 
          fontSize: 12,
          margin: 15, // 增加标签边距
          fontFamily: 'Arial, sans-serif'
        },
        min: 0,
        max: yCategories.length - 1,
        scale: false,   // 禁止自动缩放
        axisPointer: {
          type: 'line',
          label: {
            show: true,
            formatter({ value }) {
              const { count, totalCycles } = stats[value] || { count: 0, totalCycles: 0 }
              return `${value}\ncounts=${count}\ntotal=${totalCycles} cy`
            },
            backgroundColor: 'rgba(50,50,50,0.7)',
            color: '#fff',
            fontSize: 12,
            padding: [1, 1],
            borderRadius: 3
          }
        }
      }
   ],
    series: seriesArr ?? [],
    toolbox,
  };


  /* ---------- 主题合并（如果主题已注册） ---------- */
  if (echarts.getMap(themeName)) {
    return echarts.util.merge(option, echarts.getMap(themeName));
  }

  //console.log('>>> 最终 option', JSON.stringify(option, null, 2));
  return option;
}
