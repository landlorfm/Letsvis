<template>
  <div class="data-table">
    <el-table
      :data="data"
      stripe
      size="small"
      style="width: 100%"
      max-height="450"
      highlight-current-row
      :row-class-name="rowClassName"
      @row-click="(row) => $emit('row-click', row)"
    >
      <template #empty>
        <span v-if="!data.length">暂无数据</span>
      </template>

      
      <el-table-column
        v-for="col in effectiveColumns"
        :key="col.prop"
        :prop="col.prop"
        :label="col.label"
        :width="col.width"
        :min-width="col.minWidth"
        :sortable="col.sortable ?? false"
        :show-overflow-tooltip="col.showOverflowTooltip ?? false"
      >
        <template #default="scope">
          
          <component
            v-if="col.formatter"
            :is="col.formatter(scope.row, col.prop)"
          />
          <span v-else>{{ fmt(scope, col.prop, col.unit) }}</span>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<script setup>
import { computed } from 'vue'

/* ---------- 通用格式化 ---------- */
const fmt = (scope, key, unit = '') => (scope?.row?.[key] ?? '-') + (unit || '')

/* ---------- props ---------- */
/**
 * @prop {Array} data 表格数据
 * @prop {String|Number} highlightRowKey 高亮行的 key 值
 * @prop {Array} columns 列配置
 */
const props = defineProps({
  data: { type: Array, default: () => [] },
  highlightRowKey: [String, Number],
  /* 可传入列配置，不传则使用默认 timestep 列 */
  columns: { type: Array, default: () => null }
})

/**
 * @emits row-click 行点击事件
 */
const emit = defineEmits(['row-click'])

/* ---------- 默认列（向下兼容） ---------- */
const defaultColumns = [
  { prop: 'timestep', label: 'timestep', width: 90, sortable: true },
  { prop: 'timestep_type', label: 'type', width: 80 },
  { prop: 'op', label: 'op', width: 100 },
  { prop: 'concerning_op_name', label: 'op name', minWidth: 140, showOverflowTooltip: true },
  { prop: 'tensor_name', label: 'tensor', minWidth: 160, showOverflowTooltip: true },
  { prop: 'cycle', label: 'cycle', width: 80, sortable: true },
  { prop: 'duration', label: 'duration', width: 100, sortable: true, unit: ' cy' },
  { prop: '_cycStart', label: 'cycStart', width: 100, sortable: true },
  { prop: '_cycEnd', label: 'cycEnd', width: 100, sortable: true }
]


/* ---------- 生效列 ---------- */
const effectiveColumns = computed(() => props.columns || defaultColumns)

/* ---------- 高亮行（可选） ---------- */
const rowClassName = ({ row }) =>
  row[hightlightKey] === props.highlightRowKey ? 'highlight-row' : ''

const hightlightKey = effectiveColumns.value[0]?.prop ?? 'id'
</script>

<style scoped>
.data-table {
  padding: 8px;
  background: #fff;
}
/* 高亮颜色 */
:deep(.highlight-row) {
  background-color: #f0f9ff !important;
}
</style>