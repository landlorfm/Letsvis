<template>
  <div class="spec-panel" v-if="props.availableConfigs.length > 0">
    <!-- 只在有配置时显示面板 -->
    <div class="header">
      <h3>Local Memory Configuration</h3>
    </div>


    <div class="config-selector" v-if="props.availableConfigs.length > 1">
      <label>Memory Configuration:</label>
      <select v-model="selectedConfigIndex" @change="onConfigChange">
        <option v-for="(config, index) in props.availableConfigs" 
                :key="index" 
                :value="index">
          #{{ index + 1 }} - 
          allow_bank_conflict: {{ config.settings.allow_bank_conflict ? 'True' : 'False' }} | 
          shape: {{ Array.isArray(config.settings.shape_secs) ? config.settings.shape_secs.join('×') : config.settings.shape_secs }}
        </option>
      </select>
    </div>

    <div class="chip-info" v-if="props.initialSettings.lmem_bytes">
      <h4>Chip Specifications</h4>
      <div class="chip-details">
        <div class="chip-item">
          <span class="label">Total Memory:</span>
          <span class="value">{{ props.initialSettings.lmem_bytes , formatMemorySize(props.initialSettings.lmem_bytes) }}</span>
        </div>
        <div class="chip-item">
          <span class="label">Banks:</span>
          <span class="value">{{ props.initialSettings.lmem_banks || 'N/A' }}</span>
        </div>
        <div class="chip-item">
          <span class="label">Bank Size:</span>
          <span class="value">{{ props.initialSettings.lmem_bank_bytes , formatMemorySize(props.initialSettings.lmem_bank_bytes) }}</span>
        </div>
        <div class="chip-item">
          <span class="label">Bank Conflict:</span>
          <span class="value">{{ props.initialSettings.allow_bank_conflict ? 'Allowed' : 'Disallowed' }}</span>
        </div>
        <div class="chip-item">
          <span class="label">Shape Sections:</span>
          <span class="value">[{{ Array.isArray(props.initialSettings.shape_secs) ? props.initialSettings.shape_secs.join(', ') : props.initialSettings.shape_secs }}]</span>
        </div>
      </div>
    </div>
  </div>

  <div v-else class="spec-panel-loading">
    <p>Loading configurations...</p>
  </div>
</template>

<script setup>

import { ref, reactive, watch, defineProps, defineEmits, onMounted } from 'vue';

const props = defineProps({
  initialSettings: {
    type: Object,
    required: true,
    default: () => ({})
  },
  availableConfigs: {
    type: Array,
    default: () => []
  },
  currentIndex: {
    type: Number,
    default: 0
  }
});

const emit = defineEmits(['settings-change', 'config-change']);

onMounted(() => {
  // 确保有有效的配置数据
  if (props.availableConfigs.length === 0) {
    console.warn('No available configs provided to LmemSpecPanel');
  }
});

// 添加空值检查
const settings = reactive({
  allow_bank_conflict: props.initialSettings?.allow_bank_conflict ?? 0,
  shape_secs: props.initialSettings?.shape_secs ?? '1,1,1,1,1'
});

// 将shape_secs字符串转换为数组便于编辑
const shapeArray = ref(
  typeof settings.shape_secs === 'string' 
    ? settings.shape_secs.split(',').map(Number)
    : [1,1,1,1,1]
);


const selectedConfigIndex = ref(props.currentIndex);


// 修复这个watch，添加错误处理
watch(() => props.initialSettings, (newSettings) => {
  if (newSettings && Object.keys(newSettings).length > 0) {
    settings.allow_bank_conflict = newSettings.allow_bank_conflict ?? 0;
    settings.shape_secs = Array.isArray(newSettings.shape_secs) 
      ? newSettings.shape_secs.join(',') 
      : newSettings.shape_secs;
    shapeArray.value = settings.shape_secs.split(',').map(Number);
  }
}, { deep: true });

// 配置切换处理
function onConfigChange() {
  emit('config-change', selectedConfigIndex.value);
  
  // 更新本地设置
  const newSettings = props.availableConfigs[selectedConfigIndex.value]?.settings;
  if (newSettings) {
    updateLocalSettings(newSettings);
  }
}

// 更新本地设置
function updateLocalSettings(newSettings) {
  settings.allow_bank_conflict = newSettings.allow_bank_conflict ?? 0;
  settings.shape_secs = Array.isArray(newSettings.shape_secs) 
    ? newSettings.shape_secs.join(',') 
    : newSettings.shape_secs;
  shapeArray.value = settings.shape_secs.split(',').map(Number);
}

// 内存大小格式化函数
function formatMemorySize(bytes) {
  if (!bytes) return 'N/A';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

</script>

<style scoped>

.spec-panel {
  padding: 8px;
  background: #f8f9fa;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  font-size: 11px;
  line-height: 1.2;
}

.header h3 {
  margin: 0 0 4px;
  font-size: 14px;
  font-weight: 600;
  color: #2c3e50;
}



.config-selector label {
  font-size: 13px;
  color: #5c6b7a;
  margin-right: 8px;
}

.config-selector select {
  padding: 5px 8px;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  background: white;
  font-size: 13px;
}

.chip-info {
  margin-top: 8px;
}

.chip-info h4 {
  margin: 0 0 4px;
  font-size: 12px;
  color: #374151;
}

.chip-details {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;    /* 行间距4，列间距12 */
}

.chip-item {
  width: calc(33% - 6px);   /* 两列 */
  display: flex;
  justify-content: space-between;
  height: 20px;
  line-height: 20px;
}

.chip-item .label {
  color: #6b7280;
}

.chip-item .value {
  color: #111;
  font-family: Monaco, Consolas, monospace;
}


</style>
