import { reactive } from 'vue'

/**
 * 全局解析缓存
 * @typedef {Object} SharedParseResult
 * @property {Object|null} file - 解析后的文件对象
 * @property {Object|null} lmem - 解析后的 LMEM 数据
 * @property {Object|null} timestep - 解析后的 Timestep 数据
 * @property {Object|null} profile - 解析后的 Profile 数据
 * @property {Object|null} chip - 解析后的 Chip 数据
 * @property {Object} valid - 各数据类型的有效性标记
 * @property {boolean} valid.lmem - LMEM 数据是否有效
 * @property {boolean} valid.timestep - Timestep 数据是否有效
 * @property {boolean} valid.profile - Profile 数据是否有效
 * @property {boolean} valid.chip - Chip 数据是否有效
 */
export const sharedParseResult = {
  file: null,
  lmem: null,
  timestep: null,
  profile: null,
  chip: null,
  valid: { lmem: false, timestep: false, profile: false },
}

// 事件总线（极简）
/**
 * 事件总线
 * @type {EventTarget}
 */
export const eventBus = new EventTarget()

// 标记是否已解析，方便
export function hasValidData () {
  return sharedParseResult.valid.lmem || sharedParseResult.valid.timestep
}

// 页面共享配置项
/**
 * Lmem和Timestep页面共享配置项
 */
export const sharedConfig = reactive({
  shape_secs: [1, 1, 1, 1, 1],
})


// 统一入口：写回 + 广播 
/**
 * 设置共享配置项并通知变更
 * @param {string} key 配置项键
 * @param {*} value 配置项值
 */
export function setSharedConfig(key, value) {
  sharedConfig[key] = value
  eventBus.dispatchEvent(new CustomEvent('shared-config-changed', {
    detail: { key, value }
  }))
}