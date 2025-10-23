import { computed, ref } from 'vue'

/**
 * 处理 Timestep 表格数据筛选逻辑 API
 * @param {Array<Object>} rawEntries 
 * @param {*} externalFilter 
 * @returns {Object} { filter, filteredRows, opOptions, concerningOpOptions } {表格筛选条件, 筛选后数据, op 候选项, concerning_op 候选项 }
 */
export function useTableData(rawEntries, externalFilter = null) {
  /* ----- 计算列 ----- */
  const rows = computed(() =>
    (rawEntries.value ?? []).map(r => ({
      ...r,
      duration: r._cycEnd - r._cycStart
    }))
  )
  console.log('table rows', rows);

  /* ----- 筛选条件 ----- */
  const filter = externalFilter ||  ref({
    timestepMin: null,
    timestepMax: null,
    timestepType: 'all',      // 'all' | 'gdma' | 'layer'
    op: [],                   // 多选
    concerningOp: [],         // 多选（含空）
    concerningOpName: '',     // 模糊
    tensorName: '',           // 模糊
    durationMin: null,
    durationMax: null
  })

  /* ----- 候选项 ----- */
  const opOptions = computed(() => [...new Set(rows.value.map(r => r.op))].sort())
  const concerningOpOptions = computed(() => {
    const s = new Set(rows.value.map(r => r.concerning_op).filter(Boolean))
    return ['(empty)', ...s].sort()
  })

  /* ----- 过滤函数 ----- */
  const filteredRows = computed(() =>
    rows.value.filter(r => {
      const f = filter.value
      if (f.timestepMin != null && r.timestep < f.timestepMin) return false
      if (f.timestepMax != null && r.timestep > f.timestepMax) return false
      if (f.timestepType !== 'all' && r.timestep_type !== f.timestepType) return false
      if (f.op.length && !f.op.includes(r.op)) return false
      if (f.concerningOp.length) {
        const empty = f.concerningOp.includes('(empty)')
        const hit = f.concerningOp.includes(r.concerning_op)
        if (!(empty ? !r.concerning_op : hit)) return false
      }
      if (f.concerningOpName && !r.concerning_op_name?.toLowerCase().includes(f.concerningOpName.toLowerCase())) return false
      if (f.tensorName && !r.tensor_name?.toLowerCase().includes(f.tensorName.toLowerCase())) return false
      if (f.durationMin != null && r.duration < f.durationMin) return false
      if (f.durationMax != null && r.duration > f.durationMax) return false
      return true
    })
  )

  return {
    filter,
    filteredRows,
    opOptions,
    concerningOpOptions
  }
}
