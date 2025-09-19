<template>
  <label class="file-selector">
    <input type="file" accept=".log" @change="onChange" />
    <span>{{ label }}</span>
    <div v-if="statusMessage" class="status">{{ statusMessage }}</div>
  </label>
</template>

<script setup>
import { ref } from 'vue';

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
  
  // 根据有效部分更新状态
  const statusParts = [];
  if (valid.lmem) statusParts.push('LMEM');
  if (valid.summary) statusParts.push('Summary');
  if (valid.timestep) statusParts.push('Timestep');
  
  label.value = '✅ 解析完成';
  statusMessage.value = `有效数据: ${statusParts.join(', ') || '无'}`;
  
  // 发送解析结果
  emit('file-loaded', { 
    ...data,
    valid
  });
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
