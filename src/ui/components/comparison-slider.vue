<template>
  <div class="comparison-slider" v-if="files.length">
    <span>对比：</span>
    <label>
      基准
      <select v-model="baseline">
        <option v-for="f in files" :key="f.name" :value="f">{{ f.name }}</option>
      </select>
    </label>
    <label>
      目标
      <select v-model="target">
        <option v-for="f in files" :key="f.name" :value="f">{{ f.name }}</option>
      </select>
    </label>
    <button @click="compare">执行对比</button>
  </div>
</template>

<script setup>
import { ref } from 'vue';

const props = defineProps({
  files: { type: Array, default: () => [] }  // { name, data }[]
});
const emit = defineEmits(['compare']);

const baseline = ref(null);
const target   = ref(null);

function compare() {
  if (!baseline.value || !target.value) return;
  emit('compare', { baseline: baseline.value, target: target.value });
}
</script>

<style scoped>
.comparison-slider {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
}
.comparison-slider select {
  padding: 2px 4px;
}
</style>