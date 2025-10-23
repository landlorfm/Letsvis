<template>
  <div class="spec-panel" v-if="legalSettingsSnap.length">
    <!-- 只在有配置时显示面板 -->
    <div class="header">
      <h3>Local Memory Configuration</h3>
    </div>

    <!--错误提示 -->
    <div v-if="illegal" class="panel-err">
      ⚠️ 当前配置组合不存在，请重新选择！
      <button class="close-btn" @click="$emit('close-err')">×</button>
    </div>

    <!-- 共享 key -->
    <div v-for="key in sharedKeys" :key="'s-'+key" class="field-line">
      <label>{{ key }} (共享)</label>
      <!-- <select :value="props.settings[key]"
              @change="e => emit('local-pick',{key, value: cast(e.target.value, key)})"> -->
            <select
              :value="props.settings[key]"
              @change="e => {
                const v = cast(e.target.value, key);
                setSharedConfig(key, v);        // 写全局
                emit('local-pick', { key, value: v });
              }"
            >
        <option v-for="v in keyCandidateMap[key]" :key="v" :value="v">{{ fmt(v) }}</option>
      </select>
    </div>

    <!-- 非共享 key -->
    <div v-for="key in localKeys" :key="'l-'+key" class="field-line">
      <label>{{ key }}</label>
      <select :value="props.settings[key]"
              @change="e => updateLocalKey(key, cast(e.target.value, key))">
        <option v-for="v in keyCandidateMap[key]" :key="v" :value="v">{{ fmt(v) }}</option>
      </select>
    </div>

    <div class="current-setting">
      <h4>当前配置</h4>
      <div v-for="(v, k) in matched" :key="k" class="setting-line">
        <span class="k">{{ k }}:</span>
        <span class="v">{{ fmt(v) }}</span>
      </div>
    </div>

  </div>

  <div v-else class="spec-panel-loading">
    <p>Loading configurations...</p>
  </div>
</template>

<script setup>
/**
 * 本面板用于显示和选择相关配置项
 * 共享字段改动会通过 eventBus 广播
 * 本地字段改动通过 emit 传给父组件
 * @module components/SpecPanel
 * @fires local-pick  本地字段变更时触发
 * @fires close-err   点击关闭错误提示时触发
 */
import { ref, reactive, watch, defineProps, defineEmits, onMounted, computed } from 'vue';
import { sharedConfig, setSharedConfig, eventBus } from '@/utils/shared-state.js'

/**
 * 完整配置对象（含共享/本地字段）
 * @param {Object} props
 * @param {Object} props.settings          当前配置键值对
 * @param {string[]} [props.sharedKeys]    被视为共享的字段名列表，默认 ['shape_secs']
 * @param {string[]} props.legalSnaps      合法配置快照（JSON 字符串数组）
 * @param {Object} [props.matched]         当前命中的完整配置
 * @param {boolean} [props.illegal]        当前配置是否非法
 */
const props = defineProps({
  /* 完整配置对象，用来取独立字段 */
  settings: { type: Object, required: true },
  /* 只需要传一份“共享字段白名单” */
  sharedKeys: { type: Array, default: () => ['shape_secs'] },
  /* 合法配置快照 */
  legalSnaps:  { type: Array,  default: () => [] },  // 空数组保底
  /* 当前命中配置 */
  matched:    { type: Object, default: () => ({}) },
  /* 错误配置项提示 */
  illegal:       { type: Boolean, default: false }

})

const legalSettingsSnap = computed(() => props.legalSnaps)

// const emit = defineEmits(['local-change'])
// const emit = defineEmits(['local-pick'])
/**
 * 更新本地字段并通知父组件
 */
const emit = defineEmits(['local-pick', 'close-err'])


/* 外部页面改了共享项，同步回来 */
onMounted(() => {
  eventBus.addEventListener('shared-config-changed', e => {
    /* 这里什么都不用做，sharedConfig 已是 reactive，
      面板显示自动刷新；父页图表监听同一事件即可 */
  })
})


/**
 * 收集某字段在所有合法配置中出现过的值（去重 & 排序）
 * @param {string} key
 * @returns {Array} 排序后的候选值
 */
function collectValues(key) {
  const set = new Set(legalSettingsSnap.value.map(s => JSON.parse(s)[key]))
  return Array.from(set).sort()
}

// 所有 key 的候选值表  { key: [v1,v2,...] }
// 不参与下拉、不参与匹配的只读字段
const READ_ONLY_KEYS = ['lmem_bank_bytes', 'lmem_banks', 'lmem_bytes', 
                        'totalCycle', 'lastBdId', 'lastGdmaId', 'tcyc', 'ddrBwUsage', 'flops', 'runtime_Ms', 'computationAbility_T'
                      ]

const keyCandidateMap = computed(() => {
  const keys = [
    ...new Set(
      legalSettingsSnap.value.flatMap(s =>
        Object.keys(JSON.parse(s)).filter(k => !READ_ONLY_KEYS.includes(k))
      )
    )
  ]
  return Object.fromEntries(keys.map(k => [k, collectValues(k)]))
})


// 所有出现过一次的 key 全集
const allKeys = computed(() => Object.keys(keyCandidateMap.value))

// 共享 key
const sharedKeys = computed(() =>
  allKeys.value.filter(k => props.sharedKeys.includes(k))
)

// 非共享 key
const localKeys = computed(() =>
  allKeys.value.filter(k => !props.sharedKeys.includes(k))
)


/**
 * 将 <select> 字符串转回原始数据类型
 * @param {string} str
 * @param {string} key
 * @returns {string|number|boolean|Array}
 */
function cast(str, key) {
  const sample = keyCandidateMap.value[key][0]
  if (Array.isArray(sample)) return str.split(',').map(Number)
  if (typeof sample === 'number') return Number(str)
  if (typeof sample === 'boolean') return str === 'true'
  return str
}


/**
 * 格式化显示值
 * @param {*} v
 * @returns {string}
 */
function fmt(v) {
  return Array.isArray(v) ? `[${v.join(',')}]` : String(v)
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

.chip-item.shared { 
  background: #f0f9ff; 
}   /* 给共享项一点提示 */

.chip-item.local  {
   background: #fff; 
}

.current-setting {
  margin-top: 12px;
  padding: 8px;
  background: #f5f7fa;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  font-size: 12px;
}
.setting-line {
  display: flex;
  justify-content: space-between;
  height: 20px;
  line-height: 20px;
}
.k { color: #666; }
.v { font-family: Monaco, Consolas, monospace; }

.panel-err {
  margin-bottom: 8px;
  padding: 6px 10px;
  background: #ffecec;
  border: 1px solid #fcc;
  border-radius: 4px;
  font-size: 12px;
  color: #c00;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.close-btn {
  border: none;
  background: transparent;
  font-size: 16px;
  cursor: pointer;
  line-height: 1;
  color: #c00;
}

</style>
