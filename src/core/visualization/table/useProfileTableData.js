import { computed, ref } from 'vue'

const CYCLE_TO_MS = 1e-6; // 1 cycle = 1 μs = 0.001 ms
const CYCLE_TO_US = 1e-3;

/**
 * 处理 Profile 表格数据筛选逻辑 API
 * @param {Array<Object>} rawEntries 
 * @param {*} externalFilter 
 * @returns {Object} { filter, filteredRows, opOptions, concerningOpOptions } {表格筛选条件, 筛选后数据, op 候选项, type 候选项 }
 */
export function useProfileTableData(rawEntries, externalFilter = null) {
  /* ----- 计算列 ----- */
const rows = computed(() =>
  (rawEntries.value ?? []).map(r => ({
    ...r,
    duration: r.cost, // cycle
    durationMs: (r.cost * CYCLE_TO_MS).toFixed(6),
    startMs: (r.start * CYCLE_TO_MS).toFixed(6),
    endMs: ((r.start + r.cost) * CYCLE_TO_MS).toFixed(6)
    /* us */
    // durationMs: (r.cost * CYCLE_TO_MS).toFixed(3),
    // startMs: (r.start * CYCLE_TO_MS).toFixed(3),
    // endMs: ((r.start + r.cost) * CYCLE_TO_MS).toFixed(3)
  }))
)


// 建立 op → 矩形边界的索引
const opBoundaries = computed(() => {
  const map = new Map()
  for (const r of (rawEntries.value ?? [])) {
    if (!map.has(r.op)) {
      map.set(r.op, { left: r.start, right: r.start + r.cost })
    } else {
      const b = map.get(r.op)
      b.left  = Math.min(b.left,  r.start)
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
  const opOptions = computed(() => [...new Set(rows.value.map(r => r.op))])  // .sort() // 保留原始顺序
  const typeOptions = computed(() => [...new Set(rows.value.map(r => r.type))].sort())

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

  return rows.value.filter(r => {
    const f = filter.value
    if (minCycle != null && r.start + r.cost < minCycle) return false   // 完全在左边界左侧
    if (maxCycle != null && r.start > maxCycle) return false            // 完全在右边界右侧
    if (f.startMax != null && r.start > f.startMax) return false
    if (f.engine !== 'all' && r.engine !== f.engine) return false
    if (f.op.length && !f.op.includes(r.op)) return false
    if (f.type.length && !f.type.includes(r.type)) return false
    if (f.bdId != null && r.bd_id !== f.bdId) return false
    if (f.gdmaId != null && r.gdma_id !== f.gdmaId) return false
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