import { reactive } from 'vue'

// 全局解析缓存
export const sharedParseResult = {
  file: null,
  lmem: null,
  timestep: null,
  profile: null,
  chip: null,
  valid: { lmem: false, timestep: false, profile: false },
}

// 事件总线（极简）
export const eventBus = new EventTarget()

// 标记是否已解析，方便
export function hasValidData () {
  return sharedParseResult.valid.lmem && sharedParseResult.valid.timestep
}

// 页面共享配置项
export const sharedConfig = reactive({
  shape_secs: [1, 1, 1, 1, 1],
})


// 统一入口：写回 + 广播 
export function setSharedConfig(key, value) {
  sharedConfig[key] = value
  eventBus.dispatchEvent(new CustomEvent('shared-config-changed', {
    detail: { key, value }
  }))
}