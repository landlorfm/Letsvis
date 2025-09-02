/**
 * 关联LMEM分配和Timestep数据
 * @param {LmemAllocation[]} lmemData 
 * @param {TimestepAssignment[]} timestepData 
 * @returns {EnhancedTimestep[]}
 */
export function associateData(lmemData, timestepData) {
  const memoryMap = new Map(lmemData.map(item => [item.op_name, item]));
  
  return timestepData.map(timestep => ({
    ...timestep,
    compute: timestep.compute.map(op => ({
      ...op,
      memory_allocation: memoryMap.get(op.id)
    })),
    memory_usage: _calculateMemoryUsage(timestep.ts, lmemData)
  }));
}

// function _calculateMemoryUsage(currentTs, allocations) {
//   return allocations
//     .filter(alloc => 
//       alloc.timestep_start <= currentTs && 
//       alloc.timestep_end >= currentTs
//     )
//     .reduce((sum, alloc) => sum + alloc.size, 0);
// }

function _calculateMemoryUsage(currentTs, allocations) {
  return allocations
    .filter(alloc => {
      // 确保时间步范围是有效的数值
      const start = Number(alloc.timestep_start);
      const end = Number(alloc.timestep_end);
      
      // 验证时间步范围是否有效
      if (isNaN(start) || isNaN(end)) return false;
      
      // 当前时间步是否在分配的生命周期内
      return start <= currentTs && end >= currentTs;
    })
    .reduce((sum, alloc) => {
      // 确保分配大小是有效的数值
      const size = Number(alloc.size);
      return isNaN(size) ? sum : sum + size;
    }, 0);
}
