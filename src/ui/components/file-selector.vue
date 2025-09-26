<template>
  <label class="file-selector">
    <input type="file" accept=".json" @change="onChange" />
    <span>{{ label }}</span>
    <div v-if="statusMessage" class="status">{{ statusMessage }}</div>
  </label>
</template>

<script setup>
import { ref } from 'vue'
import { sharedParseResult, eventBus } from '@/utils/shared-state'

const label = ref('📁 选择日志')
const statusMessage = ref('')
const emit = defineEmits(['file-loaded'])

async function onChange(e) {
  const file = e.target.files?.[0]
  if (!file) return

  label.value = '⏳ 加载中...'
  statusMessage.value = ''

  try {
    const text = await file.text()
    const data = JSON.parse(text)

    /* 1. json 直接原样搬进缓存 */
    Object.assign(sharedParseResult, data)

    /* 2. 广播 */
    eventBus.dispatchEvent(new CustomEvent('parsed', { detail: sharedParseResult }))

    /* 3. 本地提示 */
    const parts = []
    if (sharedParseResult.valid?.lmem)     parts.push('LMEM')
    if (sharedParseResult.valid?.summary)  parts.push('Summary')
    if (sharedParseResult.valid?.timestep) parts.push('Timestep')
    if (sharedParseResult.valid?.profile)  parts.push('Profile')
    label.value = '✅ 加载完成'
    statusMessage.value = `有效数据: ${parts.join(', ') || '无'}`

    /* 4. 兼容旧事件 */
    emit('file-loaded', sharedParseResult)

  } catch (err) {
    console.error(err)
    label.value = '📁 选择日志'
    statusMessage.value = `❌ ${err.message}`
  }
}
</script>

<style scoped>
.file-selector{
  cursor:pointer;
  display:inline-flex;
  flex-direction:column;
  padding:12px;
  border:1px solid #ccc;
  border-radius:8px;
  background:#f8f9fa;
  font-size:14px;
  min-width:80px;
}
.file-selector input[type="file"]{display:none}
.status{margin-top:4px;font-size:8px;color:#666}
</style>