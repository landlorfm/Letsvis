<template>
  <div class="table-filter">
    <el-row :gutter="12">
      <el-col :span="4">
        <label>timestep</label>
        <el-input-number v-model="filter.timestepMin" :min="0" placeholder="min" controls-position="right" size="small"/>
        <el-input-number v-model="filter.timestepMax" :min="0" placeholder="max" controls-position="right" size="small"/>
      </el-col>

      <el-col :span="3">
        <label>type</label>
        <el-select v-model="filter.timestepType" size="small">
          <el-option label="All" value="all"/>
          <el-option label="GDMA" value="gdma"/>
          <el-option label="Layer" value="layer"/>
        </el-select>
      </el-col>

      <el-col :span="4">
        <label>op</label>
        <el-select v-model="filter.op" multiple collapse-tags size="small">
          <el-option v-for="o in opOptions" :key="o" :label="o" :value="o"/>
        </el-select>
      </el-col>

      <el-col :span="4">
        <label>concerning op</label>
        <el-select v-model="filter.concerningOp" multiple collapse-tags size="small">
          <el-option v-for="c in concerningOpOptions" :key="c" :label="c" :value="c"/>
        </el-select>
      </el-col>

      <el-col :span="3">
        <label>concer op name</label>
        <el-input v-model="filter.concerningOpName" placeholder="输入" size="small"/>
      </el-col>

      <el-col :span="3">
        <label>tensor name</label>
        <el-input v-model="filter.tensorName" placeholder="输入" size="small"/>
      </el-col>

      <el-col :span="3">
        <label>duration</label>
        <el-input-number v-model="filter.durationMin" :min="0" placeholder="min" controls-position="right" size="small"/>
        <el-input-number v-model="filter.durationMax" :min="0" placeholder="max" controls-position="right" size="small"/>
      </el-col>
    </el-row>

    <div class="filter-actions">
      <el-button size="small" @click="$emit('reset')">重置</el-button>
      <el-button type="primary" size="small" @click="$emit('apply')">应用</el-button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

/**
 * @prop {Object} filter 过滤器对象
 * @prop {Array} opOptions 可选的 op 列表
 * @prop {Array} concerningOpOptions 可选的 concerningOp 列表
 */
const props = defineProps({
  filter: { type: Object, default: () => ({}) },
  opOptions: { type: Array, default: () => [] },
  concerningOpOptions: { type: Array, default: () => [] }
})

</script>

<style scoped>
.table-filter { padding: 12px; background: #fff; border-bottom: 1px solid #e0e0e0; }
label { display: block; font-size: 12px; margin-bottom: 4px; color: #666; }
.filter-actions { margin-top: 8px; text-align: right; }
</style>