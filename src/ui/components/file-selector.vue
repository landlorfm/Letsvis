<template>
  <label class="file-selector">
    <input type="file" accept=".log" @change="onChange" />
    <span>{{ label }}</span>
    <div v-if="statusMessage" class="status">{{ statusMessage }}</div>
  </label>
</template>

<script setup>
import { ref } from 'vue';
import { sharedParseResult, eventBus } from '../../utils/shared-state';

const label = ref('📁 选择日志');
const statusMessage = ref('');

const emit = defineEmits(['file-loaded']);

// 实例化 Worker
const worker = new Worker(new URL('@/workers/parser.worker.js?worker', import.meta.url), { type: 'module' });

worker.onmessage = (e) => {
  const { success, error, valid, ...data } = e.data;
  
  if (!success) {
    statusMessage.value = `❌ ${error || '解析失败'}`;
    return;
  }

    // 1. 缓存到全局
  Object.assign(sharedParseResult, {
    lmem: data.lmem,
    summary: data.summary,
    timestep: data.timestep,
    chip: data.chip,
    valid
  })

  // 2. 广播给所有页面
  eventBus.dispatchEvent(new CustomEvent('parsed', { detail: sharedParseResult }))

  // 3. 本地回显
  const parts = []
  if (valid.lmem) parts.push('LMEM')
  if (valid.summary) parts.push('Summary')
  if (valid.timestep) parts.push('Timestep')
  label.value = '✅ 解析完成'
  statusMessage.value = `有效数据: ${parts.join(', ') || '无'}`

  // 4. 兼容旧 emit
  emit('file-loaded', sharedParseResult)
};

async function onChange(e) {
  const file = e.target.files[0];
  if (!file) return;

  label.value = '⏳ 解析中...';
  statusMessage.value = '';
  
  try {
    const text = await file.text();
    worker.postMessage(text);
  } catch (err) {
    console.error(err);
    label.value = '📁 选择日志';
    statusMessage.value = '❌ 文件读取失败';
  }
}
</script>

<style scoped>
.file-selector {
  cursor: pointer;
  display: inline-flex;
  flex-direction: column;
  padding: 12px;
  border: 1px solid #ccc;
  border-radius: 8px;
  background: #f8f9fa;
  font-size: 14px;
  min-width: 80px;
}

.file-selector input[type="file"] {
  display: none;
}

.status {
  margin-top: 4px;
  font-size: 8px;
  color: #666;
}
</style>
