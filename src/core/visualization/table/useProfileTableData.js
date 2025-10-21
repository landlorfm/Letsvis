import { computed, ref } from 'vue'

const CYCLE_TO_MS = 1e-6; // 1 cycle = 1 μs = 0.001 ms
const CYCLE_TO_US = 1e-3;

export function useProfileTableData(rawEntries, externalFilter = null) {
  /* ----- 处理两种数据格式 ----- */
  const processedEntries = computed(() => {
    const entries = rawEntries.value;
    if (!entries) return [];
    
    // 优化格式（列式存储）
    if (entries.format === 'columnar_v1') {
      return convertOptimizedToTableData(entries);
    }
    
    // 传统格式（对象数组）
    return (entries ?? []).map(r => ({
      ...r,
      duration: r.cost, // cycle
      durationMs: (r.cost * CYCLE_TO_MS).toFixed(6),
      startMs: (r.start * CYCLE_TO_MS).toFixed(6),
      endMs: ((r.start + r.cost) * CYCLE_TO_MS).toFixed(6)
    }));
  })

  // 将优化格式转换为表格数据
  function convertOptimizedToTableData(optimizedEntries) {
    const result = [];
    const total = optimizedEntries.total_entries;
    
    for (let i = 0; i < total; i++) {
      const start = optimizedEntries.timestep?.[i] || 0;
      const cost = optimizedEntries.cost?.[i] || 0;
      const end = start + cost;
      
      result.push({
        // 原始字段
        op: optimizedEntries.op?.[i] || '',
        type: optimizedEntries.type?.[i] || '',
        engine: optimizedEntries.engine?.[i] || '',
        start: start,
        cost: cost,
        end: end,
        bd_id: optimizedEntries.bd_id?.[i] ?? -1,
        gdma_id: optimizedEntries.gdma_id?.[i] ?? -1,
        direction: optimizedEntries.direction?.[i] ?? -1,
        size: optimizedEntries.size?.[i] || 0,
        bandwidth: optimizedEntries.bandwidth?.[i] || 0,
        
        // 计算字段
        duration: cost,
        durationMs: (cost * CYCLE_TO_MS).toFixed(6),
        startMs: (start * CYCLE_TO_MS).toFixed(6),
        endMs: (end * CYCLE_TO_MS).toFixed(6),
        
        // 原始索引（用于反向查找）
        _index: i,
        _isOptimized: true
      });
    }
    
    return result;
  }

  /* ----- 计算列 ----- */
  const rows = computed(() => processedEntries.value)

  // 建立 op → 矩形边界的索引（支持两种格式）
  const opBoundaries = computed(() => {
    const map = new Map()
    for (const r of processedEntries.value) {
      if (!map.has(r.op)) {
        map.set(r.op, { left: r.start, right: r.start + r.cost })
      } else {
        const b = map.get(r.op)
        b.left  = Math.min(b.left, r.start)
        b.right = Math.max(b.right, r.start + r.cost)
      }
    }
    return map
  })

  /* ----- 筛选条件 ----- */
  const filter = externalFilter || ref({
    startOpMin: null,   // 起始算子名
    startOpMax: null,    // 结束算子名
    startMin: null,      // cycle
    startMax: null,
    engine: 'all',       // 'all' | 'BD' | 'GDMA'
    op: [],              // 多选
    type: [],            // 多选（AR / GDMA_TENSOR ...）
    bdId: null,          // 单选（null 表示不过滤）
    gdmaId: null,
    durationMin: null,   // cycle
    durationMax: null,
    direction: 'all',     // 'all' | 0 | 1
  })

  /* ----- 候选项 ----- */
  const opOptions = computed(() => {
    const entries = processedEntries.value;
    const ops = new Set();
    entries.forEach(r => {
      if (r.op) ops.add(r.op);
    });
    return Array.from(ops).sort();
  })

  const typeOptions = computed(() => {
    const entries = processedEntries.value;
    const types = new Set();
    entries.forEach(r => {
      if (r.type) types.add(r.type);
    });
    return Array.from(types).sort();
  })

  /* ----- 过滤函数 ----- */
  const filteredRows = computed(() => {
    const { startOpMin, startOpMax } = filter.value
    let minCycle = null
    let maxCycle = null

    if (startOpMin) {
      const b = opBoundaries.value.get(startOpMin)
      if (b) minCycle = b.left          // 最左矩形
    }
    if (startOpMax) {
      const b = opBoundaries.value.get(startOpMax)
      if (b) maxCycle = b.right         // 最右矩形
    }

    return processedEntries.value.filter(r => {
      const f = filter.value
      if (minCycle != null && r.start + r.cost < minCycle) return false   // 完全在左边界左侧
      if (maxCycle != null && r.start > maxCycle) return false            // 完全在右边界右侧
      if (f.startMin != null && r.start < f.startMin) return false
      if (f.startMax != null && r.start > f.startMax) return false
      if (f.engine !== 'all' && r.engine !== f.engine) return false
      if (f.op.length && !f.op.includes(r.op)) return false
      if (f.type.length && !f.type.includes(r.type)) return false
      if (f.bdId != null && r.bd_id !== f.bdId) return false
      if (f.gdmaId != null && r.gdma_id !== f.gdmaId) return false
      
      // Duration 过滤（保持原逻辑）
      const minCyc = f.durationMin != null ? f.durationMin * 1e6 : null
      const maxCyc = f.durationMax != null ? f.durationMax * 1e6 : null
      if (minCyc != null && r.duration < minCyc) return false
      if (maxCyc != null && r.duration > maxCyc) return false
      
      if (f.direction !== 'all' && r.direction !== f.direction) return false
      return true
    })
  })

  return {
    filter,
    filteredRows,
    opOptions,
    concerningOpOptions: typeOptions // 复用字段名，下游组件不用改
  }
}

// import { computed, ref } from 'vue'

// const CYCLE_TO_MS = 1e-6; // 1 cycle = 1 μs = 0.001 ms
// const CYCLE_TO_US = 1e-3;

// export function useProfileTableData(rawEntries, externalFilter = null) {
//   /* ----- 计算列 ----- */
// const rows = computed(() =>
//   (rawEntries.value ?? []).map(r => ({
//     ...r,
//     duration: r.cost, // cycle
//     durationMs: (r.cost * CYCLE_TO_MS).toFixed(6),
//     startMs: (r.start * CYCLE_TO_MS).toFixed(6),
//     endMs: ((r.start + r.cost) * CYCLE_TO_MS).toFixed(6)
//     /* us */
//     // durationMs: (r.cost * CYCLE_TO_MS).toFixed(3),
//     // startMs: (r.start * CYCLE_TO_MS).toFixed(3),
//     // endMs: ((r.start + r.cost) * CYCLE_TO_MS).toFixed(3)
//   }))
// )


// // 建立 op → 矩形边界的索引
// const opBoundaries = computed(() => {
//   const map = new Map()
//   for (const r of (rawEntries.value ?? [])) {
//     if (!map.has(r.op)) {
//       map.set(r.op, { left: r.start, right: r.start + r.cost })
//     } else {
//       const b = map.get(r.op)
//       b.left  = Math.min(b.left,  r.start)
//       b.right = Math.max(b.right, r.start + r.cost)
//     }
//   }
//   return map
// })

//   /* ----- 筛选条件 ----- */
//   const filter = externalFilter || ref({
//     startOpMin: null,   // 起始算子名
//     startOpMax: null,    // 结束算子名
//     startMin: null,      // cycle
//     startMax: null,
//     engine: 'all',       // 'all' | 'BD' | 'GDMA'
//     op: [],              // 多选
//     type: [],            // 多选（AR / GDMA_TENSOR ...）
//     bdId: null,          // 单选（null 表示不过滤）
//     gdmaId: null,
//     durationMin: null,   // cycle
//     durationMax: null,
//     direction: 'all',     // 'all' | 0 | 1
//   })

//   /* ----- 候选项 ----- */
//   const opOptions = computed(() => [...new Set(rows.value.map(r => r.op))].sort())
//   const typeOptions = computed(() => [...new Set(rows.value.map(r => r.type))].sort())

//   /* ----- 过滤函数 ----- */
// const filteredRows = computed(() => {
//   const { startOpMin, startOpMax } = filter.value
//   let minCycle = null
//   let maxCycle = null

//   if (startOpMin) {
//     const b = opBoundaries.value.get(startOpMin)
//     if (b) minCycle = b.left          // 最左矩形
//   }
//   if (startOpMax) {
//     const b = opBoundaries.value.get(startOpMax)
//     if (b) maxCycle = b.right         // 最右矩形
//   }

//   return rows.value.filter(r => {
//     const f = filter.value
//     if (minCycle != null && r.start + r.cost < minCycle) return false   // 完全在左边界左侧
//     if (maxCycle != null && r.start > maxCycle) return false            // 完全在右边界右侧
//     if (f.startMax != null && r.start > f.startMax) return false
//     if (f.engine !== 'all' && r.engine !== f.engine) return false
//     if (f.op.length && !f.op.includes(r.op)) return false
//     if (f.type.length && !f.type.includes(r.type)) return false
//     if (f.bdId != null && r.bd_id !== f.bdId) return false
//     if (f.gdmaId != null && r.gdma_id !== f.gdmaId) return false
//     const minCyc = f.durationMin != null ? f.durationMin * 1e6 : null
//     const maxCyc = f.durationMax != null ? f.durationMax * 1e6 : null
//     if (minCyc != null && r.duration < minCyc) return false
//     if (maxCyc != null && r.duration > maxCyc) return false
//     if (f.direction !== 'all' && r.direction !== f.direction) return false
//     return true
//   })
// })

//   return {
//     filter,
//     filteredRows,
//     opOptions,
//     concerningOpOptions: typeOptions // 复用字段名，下游组件不用改
//   }
// }