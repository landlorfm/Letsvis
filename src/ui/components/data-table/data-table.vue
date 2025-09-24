<template>
  <div class="data-table">
    <el-table
        :data="data"
        stripe
        size="small"
        style="width: 100%"
        max-height="450"
        @row-click="(row)=>$emit('row-click',row)">
        <!-- 空数据保护 -->
      <template #empty>
        <span v-if="!data.length">暂无数据</span>
      </template>
      <el-table-column prop="timestep" label="timestep" width="90" sortable/>
      <el-table-column prop="timestep_type" label="type" width="80"/>
      <el-table-column prop="op" label="op" width="100"/>
      <el-table-column prop="concerning_op_name" label="op name" min-width="140" show-overflow-tooltip/>
      <el-table-column prop="tensor_name" label="tensor" min-width="160" show-overflow-tooltip/>
      <el-table-column prop="cycle" label="cycle" width="80" sortable/>
      <el-table-column prop="duration" label="duration" width="100" sortable>
        <!-- <template #default="{row}">{{ row.duration }} cy</template> -->
        <template #default="scope">{{ fmt(scope, 'duration', ' cy') }}</template>
      </el-table-column>
      <el-table-column prop="_cycStart" label="cycStart" width="100" sortable/>
      <el-table-column prop="_cycEnd" label="cycEnd" width="100" sortable/>
    </el-table>
  </div>
</template>

<script setup>
const fmt = (scope, key, unit = '') =>
  (scope?.row?.[key] ?? '-') + unit

defineProps({
  data: { type: Array, default: () => [] },
  highlightRowKey: [String, Number]
})
defineEmits(['row-click'])
</script>