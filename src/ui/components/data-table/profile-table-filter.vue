<template>
  <div class="table-filter">
    <el-row :gutter="12">
      <el-col :span="5">
        <label>op 区间</label>
        <el-select v-model="filter.startOpMin" placeholder="起始算子" size="small" clearable>
          <el-option v-for="o in opOptions" :key="o" :label="o" :value="o"/>
        </el-select>
        <el-select
          v-model="filter.startOpMax" placeholder="结束算子" size="small" clearable>
          <el-option v-for="o in opOptions" :key="o" :label="o" :value="o"/>
        </el-select>
      </el-col>

      <!-- start cycle -->
      <!-- <el-col :span="4">
        <label>start (cycle)</label>
        <el-input-number v-model="filter.startMin" :min="0" placeholder="min" controls-position="right" size="small"/>
        <el-input-number v-model="filter.startMax" :min="0" placeholder="max" controls-position="right" size="small"/>
      </el-col> -->

      <!-- engine -->
      <el-col :span="3">
        <label>engine</label>
        <el-select v-model="filter.engine" size="small">
          <el-option label="All" value="all"/>
          <el-option label="BD" value="BD"/>
          <el-option label="GDMA" value="GDMA"/>
          <el-option label="LAYER" value="LAYER"/>
        </el-select>
      </el-col>

      <!-- op -->
      <el-col :span="4">
        <label>op</label>
        <el-select v-model="filter.op" multiple collapse-tags size="small">
          <el-option v-for="o in opOptions" :key="o" :label="o" :value="o"/>
        </el-select>
      </el-col>

      <!-- type -->
      <el-col :span="4">
        <label>type</label>
        <el-select v-model="filter.type" multiple collapse-tags size="small">
          <el-option v-for="t in typeOptions" :key="t" :label="t" :value="t"/>
        </el-select>
      </el-col>

      <!-- bd_id -->
      <el-col :span="3">
        <label>bd_id</label>
        <el-input-number v-model="filter.bdId" :min="0" :controls="false" placeholder="任意" size="small"/>
      </el-col>

      <!-- gdma_id -->
      <el-col :span="3">
        <label>gdma_id</label>
        <el-input-number v-model="filter.gdmaId" :min="0" :controls="false" placeholder="任意" size="small"/>
      </el-col>

      <!-- direction -->
      <el-col :span="2">
        <label>direction</label>
        <el-select v-model="filter.direction" size="small">
          <el-option label="All" value="all"/>
          <el-option label="0" :value="0"/>
          <el-option label="1" :value="1"/>
        </el-select>
      </el-col>

      <!-- duration -->
      <el-col :span="4">
        <label>duration (ms)</label>
        <el-input-number v-model="filter.durationMin" :min="0" placeholder="min" controls-position="right" size="small" :precision="3"/>
        <el-input-number v-model="filter.durationMax" :min="0" placeholder="max" controls-position="right" size="small" :precision="3"/>
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
 * @prop {Array} concerningOpOptions 可选的 type 列表
 */
const props = defineProps({
  filter: { type: Object, default: () => ({}) },
  opOptions: { type: Array, default: () => [] },
  // 这里复用 concerningOpOptions 字段名，下游组件不用改
  concerningOpOptions: { type: Array, default: () => [] }
})

const typeOptions = computed(() => props.concerningOpOptions)

</script>

<style scoped>
.table-filter { padding: 12px; background: #fff; border-bottom: 1px solid #e0e0e0; }
label { display: block; font-size: 12px; margin-bottom: 4px; color: #666; }
.filter-actions { margin-top: 8px; text-align: right; }
</style>