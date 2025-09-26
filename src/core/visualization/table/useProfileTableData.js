import { computed, ref } from 'vue'

export function useProfileTableData(rawEntries, externalFilter = null) {
  /* ----- 计算列 ----- */
//   const rows = computed(() =>
//     (rawEntries.value ?? []).map(r => ({
//       ...r,
//       duration: r.cost, // profile 自带 cost 即耗时（cycle）
//       durationMs: (r.cost * 1e-6).toFixed(3) // 新增 ms 显示列
//     }))
//   )
const rows = computed(() =>
  (rawEntries.value ?? []).map(r => ({
    ...r,
    duration: r.cost, // cycle
    durationMs: (r.cost * 1e-6).toFixed(3),
    startMs: (r.start * 1e-6).toFixed(3),
    endMs: ((r.start + r.cost) * 1e-6).toFixed(3)
  }))
)

  /* ----- 筛选条件 ----- */
  const filter = externalFilter || ref({
    startMin: null,      // cycle
    startMax: null,
    engine: 'all',       // 'all' | 'BD' | 'GDMA'
    op: [],              // 多选
    type: [],            // 多选（AR / GDMA_TENSOR ...）
    bdId: null,          // 单选（null 表示不过滤）
    gdmaId: null,
    durationMin: null,   // cycle
    durationMax: null
  })

  /* ----- 候选项 ----- */
  const opOptions = computed(() => [...new Set(rows.value.map(r => r.op))].sort())
  const typeOptions = computed(() => [...new Set(rows.value.map(r => r.type))].sort())

  /* ----- 过滤函数 ----- */
  const filteredRows = computed(() =>
    rows.value.filter(r => {
      const f = filter.value
      if (f.startMin != null && r.start < f.startMin) return false
      if (f.startMax != null && r.start > f.startMax) return false
      if (f.engine !== 'all' && r.engine !== f.engine) return false
      if (f.op.length && !f.op.includes(r.op)) return false
      if (f.type.length && !f.type.includes(r.type)) return false
      if (f.bdId != null && r.bd_id !== f.bdId) return false
      if (f.gdmaId != null && r.gdma_id !== f.gdmaId) return false
      if (f.durationMin != null && r.duration < f.durationMin) return false
      if (f.durationMax != null && r.duration > f.durationMax) return false
      return true
    })
  )

  return {
    filter,
    filteredRows,
    opOptions,
    concerningOpOptions: typeOptions // 复用字段名，下游组件不用改
  }
}