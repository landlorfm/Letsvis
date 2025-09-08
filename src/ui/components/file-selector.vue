<!-- <template>
  <label class="file-selector">
    <input type="file" accept=".log" @change="onChange" />
    <span>{{ label }}</span>
  </label>
</template>

<script setup>



import { ref } from 'vue';
//import { parseLog } from '@/workers/parser.worker?worker'; // 稍后挂到你的 Worker

const label = ref('📁 选择日志');

const emit = defineEmits(['file-loaded']);

// 实例化 Worker
const worker = new Worker(new URL('@/workers/parser.worker.js?worker', import.meta.url), { type: 'module' });

worker.onmessage = (e) => {
  const { lmem, timestep, summary, error } = e.data;
  if (error) {
    label.value = '❌ 解析失败';
    console.error(error);
  } else {
    label.value = '✅ 解析完成';
    emit('file-loaded', { lmem, timestep, summary });
  }
};


async function onChange(e) {
  const file = e.target.files[0];
  if (!file) return;

  label.value = '⏳ 解析中...';
  try {
    const text = await file.text();
    // 调用 Web Worker 解析
    worker.postMessage( text );
  } catch (err) {
    console.error(err);
    label.value = '❌ 解析失败';
  }
}
</script>

<style scoped>
.file-selector {
  cursor: pointer;
  display: inline-block;
  padding: 6px 12px;
  border: 1px solid #ccc;
  border-radius: 4px;
  background: #fafafa;
  font-size: 14px;
}
.file-selector input[type="file"] {
  display: none;
}
</style>



 <!-- <template>
  <label class="file-selector">
    <input type="file" accept=".log" @change="onChange" />
    <span>{{ label }}</span>
  </label>
</template>

<script setup>
import { ref } from 'vue';
// 直接引入解析器（主线程）
import { extractValidSections } from '@/core/parser/log-preprocessor.js';
import { LmemParser }           from '@/core/parser/lmem-parser.js';
import { TimestepParser }       from '@/core/parser/timestep-parser.js';
import { associateData }        from '@/core/parser/log-associator.js';

const label = ref('📁 选择日志');
const emit  = defineEmits(['file-loaded']);

async function onChange(e) {
  const file = e.target.files[0];
  if (!file) return;
  label.value = '⏳ 解析中...';
  try {
    const raw = await file.text();
    console.log('[Main] raw length:', raw.length);

    // 1️⃣ 提取段
    const { lmemSections, timestepSections } = extractValidSections(raw);
    console.log('[Main] lmemSections:', lmemSections);
    console.log('[Main] timestepSections:', timestepSections);

    // 2️⃣ 解析
    const lmemParser     = new LmemParser();
    const timestepParser = new TimestepParser();
    const lmemData       = lmemParser.parse(lmemSections);
    const timestepData   = timestepParser.parse(timestepSections);
    console.log('[Main] lmemData:', lmemData);
    console.log('[Main] timestepData:', timestepData);

    // 3️⃣ 关联
    const summary = associateData(lmemData, timestepData);
    console.log('[Main] summary:', summary);

    emit('file-loaded', { lmem: lmemData, timestep: timestepData, summary });
    label.value = '✅ 解析完成';
  } catch (err) {
    console.error('[Main]', err);
    label.value = '❌ 解析失败';
  }
}
</script>

<style scoped>
.file-selector {
  cursor: pointer;
  display: inline-block;
  padding: 6px 12px;
  border: 1px solid #ccc;
  border-radius: 4px;
  background: #fafafa;
  font-size: 14px;
}
.file-selector input[type="file"] {
  display: none;
}
</style> --> -->




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
const worker = new Worker(new URL('@/workers/parser.worker.js?worker', import.meta.url), { 
  type: 'module' 
});

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
