import * as echarts from 'echarts';
import { createLane } from '../lanes/lane-factory';

const CYCLE_TO_MS = 1e-6; // 1 cycle = 1 μs = 0.001 ms
const CYCLE_TO_US = 1e-3;


// Profile数据访问器 - 适配列式存储
export class ProfileDataAccessor {
  constructor(profileData) {
    this.data = profileData;
    this.entries = profileData.entries;
    this.settings = profileData.settings || {};
    
    // 检查是否为优化格式
    this.isOptimized = this.entries && this.entries.format === 'columnar_v1';
    
    if (this.isOptimized) {
      this._convertToTypedArrays();
      // 预构建数组缓存
      this._entriesArray = this._buildEntriesArray();
    }
  }

  _convertToTypedArrays() {
    // 在JS端将Python的list转换为真正的TypedArray
    const entries = this.entries;
    
    // 数值字段转换
    if (Array.isArray(entries.timestep)) {
      entries.timestep = new Uint32Array(entries.timestep);
    }
    if (Array.isArray(entries.cycle)) {
      entries.cycle = new Uint32Array(entries.cycle);
    }
    if (Array.isArray(entries.bandwidth)) {
      entries.bandwidth = new Float32Array(entries.bandwidth);
    }
    if (Array.isArray(entries.cost)) {
      entries.cost = new Uint32Array(entries.cost);
    }
    if (Array.isArray(entries.start_addr)) {
      entries.start_addr = new Uint32Array(entries.start_addr);
    }
    if (Array.isArray(entries.size)) {
      entries.size = new Uint32Array(entries.size);
    }
    if (Array.isArray(entries.bd_id)) {
      entries.bd_id = new Int32Array(entries.bd_id);
    }
    if (Array.isArray(entries.gdma_id)) {
      entries.gdma_id = new Int32Array(entries.gdma_id);
    }
    if (Array.isArray(entries.direction)) {
      entries.direction = new Int32Array(entries.direction);
    }
  }

  // 获取总cycle数 - 修复版
  getTotalCycle() {
    if (this.isOptimized) {
      const entries = this.entries;
      let maxCycle = 0;
      const total = entries.total_entries;
      
      // 手动遍历计算最大值
      for (let i = 0; i < total; i++) {
        const cycleEnd = entries.timestep[i] + entries.cost[i];
        if (cycleEnd > maxCycle) {
          maxCycle = cycleEnd;
        }
      }
      return Math.max(maxCycle, this.settings.totalCycle || 0);
    } else {
      // 传统格式
      return this.settings.totalCycle //|| Math.max(...this.entries.map(e => e.start + e.cost), 0);
    }
  }


  // // 获取所有条目（兼容接口）
  // getAllEntries() {
  //   if (this.isOptimized) {
  //     const entries = this.entries;
  //     const total = entries.total_entries;
  //     const result = [];
  //     for (let i = 0; i < total; i++) {
  //       result.push(this.getEntryByIndex(i));
  //     }
  //     return result;
  //   }
  //   return this.entries || []; // 传统格式直接返回数组
  // }

   // 预构建数组缓存
  _buildEntriesArray() {
    if (!this.isOptimized) return null;
    
    const entries = this.entries;
    const total = entries.total_entries;
    const result = [];
    
    for (let i = 0; i < total; i++) {
      result.push(this.getEntryByIndex(i));
    }
    
    return result;
  }

  // 获取所有条目 - 确保返回数组
  getAllEntries() {
    if (this.isOptimized) {
      // 返回预构建的数组
      return this._entriesArray || [];
    } else {
      // 传统格式直接返回数组
      return this.entries || [];
    }
  }

  // 通过索引获取条目（优化格式）
  getEntryByIndex(index) {
    if (!this.isOptimized) {
      return this.entries[index];
    }

    const entries = this.entries;
    return {
      // 数值字段
      timestep: entries.timestep?.[index] || 0,
      start: entries.timestep?.[index] || 0,
      end: (entries.timestep?.[index] || 0) + (entries.cost?.[index] || 0),
      cost: entries.cost?.[index] || 0,
      cycle: entries.cost?.[index] || 0, // 兼容字段
      bandwidth: entries.bandwidth?.[index] || 0,
      start_addr: entries.start_addr?.[index] || 0,
      size: entries.size?.[index] || 0,
      bd_id: entries.bd_id?.[index] ?? -1,
      gdma_id: entries.gdma_id?.[index] ?? -1,
      direction: entries.direction?.[index] ?? -1,
      
      // 字符串字段
      op: entries.op?.[index] || '',
      type: entries.type?.[index] || '',
      engine: entries.engine?.[index] || '',
      tensor_name: entries.tensor_name?.[index] || '',
      concerning_op: entries.concerning_op?.[index] || '',
      timestep_type: entries.timestep_type?.[index] || '',
      
      // 轻量引用
      _index: index,
      _isOptimized: true
    };
  }

  // 通过引用获取完整数据
  getEntryByRef(ref) {
    if (!ref) return null;
    
    if (ref._isOptimized) {
      return this.getEntryByIndex(ref._index);
    }
    return ref; // 传统格式直接返回
  }

  // 获取条目总数
  getTotalEntries() {
    if (this.isOptimized) {
      return this.entries.total_entries || 0;
    }
    return this.entries.length || 0;
  }
}

// 创建访问器实例
function createProfileDataAccessor(profileData) {
  return new ProfileDataAccessor(profileData);
}


// /* ---------- 主函数 ---------- */
// export function genProfileOption({
//   profileData,
//   laneOrder,
//   visibleKeys = null,
//   chartInst
// }) {
//   if (!profileData?.length) {
//     return { title: { text: 'No Profile Data', left: 'center' } }
//   }
// //    console.log('【Chart】入参', { profileData, laneOrder, visibleKeys })

//   const { settings = {}, entries: rawEntries = [] } = profileData[0]
//   const totalCycle = settings.totalCycle || Math.max(...rawEntries.map(e => e.start + e.cost), 0)
//   const PAD = totalCycle * 0.0 // 30% 额外空间, 缩放渲染不吞矩形

//   /* 1. 掩码过滤（同 timestep） */
//   //console.log('visibleKeys', visibleKeys);
//   const drawingRows = rawEntries.filter(e => visibleKeys.has(`${e.op}-${e.type}-${e.start}`))
  
//   /* 1.1 计算默认显示区间 */
//   const MAX_VISIBLE_RANGE = 0.2; // 默认显示20%的时间范围
//   const defaultStart = 0;
//   const defaultEnd = Math.ceil(totalCycle * MAX_VISIBLE_RANGE);
//   console.log('drawingRows', drawingRows);


//   /* 2. 用 laneOrder + 工厂 创建泳道（对标 timestep） */
//   const yCategories = []
//   const lanes = []
//   laneOrder.forEach((key, idx) => {
//     const lane = createLane(key)
//     lane.categoryIdx = idx
//     yCategories.push(lane.laneName)
//     lanes.push(lane)
//   })
  
//   // 数据预处理：根据 zoom 范围筛选和采样
//   const zoomRange = chartInst?.getOption()?.dataZoom?.[0] || { 
//     start: 0, 
//     end: MAX_VISIBLE_RANGE * 100 
//   };
  

//   /* 3. 生成 series + 动态 legend */
//   let seriesArr = []
//   // const legendData = []
//   lanes.forEach(lane => {
//     const seriesOpt = lane.toSeriesOption(drawingRows)
//     seriesOpt.id = `profile-custom-click-${lane.laneName}`;  // 与监听同名
//     seriesOpt.silent = false;                 // 关键：允许事件
//     seriesArr.push(seriesOpt)
//   })
//   seriesArr = seriesArr.filter(
//   s => !(s.type === 'custom' && (!s.data || s.data.length === 0))
//   )

export function genProfileOption({
  profileData,
  laneOrder,
  visibleKeys = null,
  chartInst,
  dataAccessor
}) {
  if (!profileData?.length) {
    return { title: { text: 'No Profile Data', left: 'center' } }
  }

  // 创建数据访问器
  // const dataAccessor = createProfileDataAccessor(profileData[0]);
  // const totalCycle = dataAccessor.getTotalCycle();
  const accessor = dataAccessor || createProfileDataAccessor(profileData[0]);
  const totalCycle = accessor.getTotalCycle();
  const PAD = totalCycle * 0.0;

  /* 1. 计算默认显示区间 */
  const MAX_VISIBLE_RANGE = 0.2;
  const defaultStart = 0;
  const defaultEnd = Math.ceil(totalCycle * MAX_VISIBLE_RANGE);

  /* 2. 用 laneOrder + 工厂 创建泳道 */
  const yCategories = [];
  const lanes = [];
  laneOrder.forEach((key, idx) => {
    const lane = createLane(key);
    lane.categoryIdx = idx;
    yCategories.push(lane.laneName);
    lanes.push(lane);
  });

  /* 3. 生成 series - 使用新的数据访问器 */
  let seriesArr = [];
  lanes.forEach(lane => {
    const seriesOpt = lane.toSeriesOption(dataAccessor, visibleKeys);
    seriesOpt.id = `profile-custom-click-${lane.laneName}`;
    seriesOpt.silent = false;
    seriesArr.push(seriesOpt);
  });
  
  seriesArr = seriesArr.filter(
    s => !(s.type === 'custom' && (!s.data || s.data.length === 0))
  );
  //console.log('seriesArr', {seriesArr})

  /* 5. 依赖箭头（预留空数组，后续接 dep-collector） */
  const depMarks = []; // TODO: 同 timestep 调用 buildDeps 后生成
  /* 6. 依赖系列挂 markLine */
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
  // const fmtAxisMs = (v) => (v * CYCLE_TO_US).toFixed(3) + ' us';
  
  return {
    animation: true,
    backgroundColor: '#fff',
    grid: { left: 100, right: 40, top: 80, bottom: 80, height: gridHeight },
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
        //const s = p.data?.raw;

        // const startMs = (s.cycStart * CYCLE_TO_MS);//.toFixed(3);
        // const endMs = (s.cycEnd * CYCLE_TO_MS);//.toFixed(3);
        // const durMs = (s.duration * CYCLE_TO_MS).toFixed(6);
        /* US */
        // const startMs = (s.cycStart * CYCLE_TO_US);//.toFixed(3);
        // const endMs = (s.cycEnd * CYCLE_TO_US);//.toFixed(3);
        // const durMs = (s.duration * CYCLE_TO_US).toFixed(3);

        const ref = p.data?.raw;
        if (!ref) return '';
        const s = accessor.getEntryByRef(ref);
        if (!s) return '';
        
        const cycStart = p.data.value[1];
        const cycEnd = p.data.value[2];
        const duration = p.data.value[3];
        
        const startMs = (cycStart * CYCLE_TO_MS);
        const endMs = (cycEnd * CYCLE_TO_MS);
        const durMs = (duration * CYCLE_TO_MS).toFixed(6);
        return `
            ${p.marker}${p.name}<br/>
            start: ${startMs} ms<br/>
            end: ${endMs} ms<br/>
            duration: ${durMs} ms<br/>
            ${s.bd_id != -1 ? `bd_id: ${s.bd_id}<br/>` : ''}
            ${s.gdma_id != -1 ? `gdma_id: ${s.gdma_id}<br/>` : ''}
            ${s.direction != -1 ? `direction: ${s.direction}<br/>` : ''}
            ${s.size != 0 ?  `size: ${s.size}<br/>` : ''}
            ${s.bandwidth != -1 ? `bandwidth: ${s.bandwidth.toFixed(2)}<br/>` : ''}
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
      { type: 'inside', xAxisIndex: 0, filterMode: 'weakFilter' },
      // { 
      //   type: 'slider',
      //   xAxisIndex: 0,
      //   filterMode: 'weakFilter',
      //   bottom: 20,
      //   height: 20,
      //   startValue: defaultStart,
      //   endValue: defaultEnd,
      //   rangeMode: ['value', 'value'],
      //   labelFormatter: (value) => (value * CYCLE_TO_MS).toFixed(3) + ' ms',
      //   minValueSpan: totalCycle * 0.001,    // 最小可以看 1% 的数据
      //   maxValueSpan: totalCycle * 0.2,     // 最大只能看 20% 的数据
      //   zoomLock: false,                     // 锁定缩放比例
      //   preventDefaultMouseMove: true        // 防止鼠标移动时的默认行为
      // },
      // { 
      //   type: 'inside',
      //   xAxisIndex: 0,
      //   filterMode: 'weakFilter',
      //   startValue: defaultStart,
      //   endValue: defaultEnd,
      //   rangeMode: ['value', 'value'],
      //   minValueSpan: totalCycle * 0.001,    // 同步滑块的限制
      //   maxValueSpan: totalCycle * 0.2,
      //   zoomLock: false
      // }
    ],
    xAxis: {
      type: 'value',
      min: 0,
      max: totalCycle + PAD,
      name: 'ms',
        axisLabel: {
            formatter: (v) => (v * CYCLE_TO_MS).toFixed(3) + ' ms'
            // formatter: (v) => (v * CYCLE_TO_US).toFixed(3) + ' us'
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
            //const totalMs = (totalCycles * CYCLE_TO_US).toFixed(3)
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
export { createProfileDataAccessor };