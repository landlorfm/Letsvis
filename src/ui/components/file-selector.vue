<template>
  <label class="file-selector">
    <input type="file" accept=".json" @change="onChange" />
    <span>{{ label }}</span>
    <div v-if="statusMessage" class="status">{{ statusMessage }}</div>
  </label>
</template>

<script setup>
/**
 * FileSelector – 日志文件选择组件
 * @module components/FileSelector
 */
import { ref } from 'vue'
import { sharedParseResult, eventBus } from '@/utils/shared-state'

const label = ref('📁 选择日志')
const statusMessage = ref('')
const emit = defineEmits(['file-loaded'])

/**
 * 处理文件选择变化, 全量缓存并广播通知
 * @param e 事件对象
 */
async function onChange(e) {
  const file = e.target.files?.[0]
  if (!file) return

  label.value = '⏳ 加载中...'
  statusMessage.value = ''

  try {
    const text = await file.text()
    const data = JSON.parse(text)

    // 1. json 直接原样搬进缓存 
    Object.assign(sharedParseResult, data)
    console.log({sharedParseResult})

    // 2. 广播 
    eventBus.dispatchEvent(new CustomEvent('parsed', { detail: sharedParseResult }))

    // 3. 本地提示 
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


<!-- <template>
  <label class="file-selector" @click="onPickerClick">
    <input
      id="filePicker"
      type="file"
      accept=".json"
      style="display:none"
      @change="onChange"
    />
    <span>{{ label }}</span>
    <div v-if="statusMessage" class="status">{{ statusMessage }}</div>
  </label>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { sharedParseResult, eventBus } from '@/utils/shared-state'

const label = ref('📁 选择日志')
const statusMessage = ref('')
const emit = defineEmits(['file-loaded'])

/* ---------- 1. 刷新回来：若打了标记，自动帮用户弹框 ---------- */
onMounted(() => {
  if (sessionStorage.getItem('autoPick') === 'true') {
    sessionStorage.removeItem('autoPick')
    // document.getElementById('filePicker').click()
     setTimeout(() => document.getElementById('filePicker').click(), 0)
  }
})

/* ---------- 2. 点击决策：有缓存就刷新，无缓存直接弹 ---------- */
function onPickerClick() {
  // 已有缓存 → 打标记 → 刷新
  if(sharedParseResult.lmem || sharedParseResult.timestep || sharedParseResult.profile){
    sessionStorage.setItem('autoPick', 'true')
    location.reload()
    return        // 刷新后代码不再执行
  }
  // 无缓存 → 直接弹框（原生 label 会触发 input）
}

async function onChange(e) {
  const file = e.target.files?.[0]
  if (!file) return

  label.value = '⏳ 加载中...'
  statusMessage.value = ''

  try {
    const text = await file.text()
    const data = JSON.parse(text)

    // 1. json 直接原样搬进缓存 
    Object.assign(sharedParseResult, data)

    // 2. 广播 
    eventBus.dispatchEvent(new CustomEvent('parsed', { detail: sharedParseResult }))

    // 3. 本地提示 
    const parts = []
    if (sharedParseResult.valid?.lmem)     parts.push('LMEM')
    if (sharedParseResult.valid?.summary)  parts.push('Summary')
    if (sharedParseResult.valid?.timestep) parts.push('Timestep')
    if (sharedParseResult.valid?.profile)  parts.push('Profile')
    label.value = '✅ 加载完成'
    statusMessage.value = `有效数据: ${parts.join(', ') || '无'}`

    // 兼容旧事件 
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
</style> -->