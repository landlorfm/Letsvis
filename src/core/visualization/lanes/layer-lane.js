import BaseLane from './base-lane.js'

const S = 45
const L = 40            


/**
 * Layer 泳道子类 （TimeStep 可视化）
 * @extends BaseLane
 */
export default class LayerLane extends BaseLane {
  constructor() {
    super('Layer', 'timestep_type')
    // 每个 timestep 已用 cycle 偏移量
    this.innerOffset = new Map() // 仅记录 ts 内已用 cycle
  }

  /**
  *把单条 entry -> 0 或多个矩形段
  * @param {Array<Object>} entry
  * @return {Array<Object>} 矩形段对象数组
  */
  parseSegments(entry) {
    if (entry.timestep_type !== 'layer') return []
    const ts = entry.timestep
    const off = this.innerOffset.get(ts) || 0
    const wid = entry.cycle || 1
    this.innerOffset.set(ts, off + wid)
    
    /* 先拿到全局坐标 */
    const seg = this.makeSegment(ts, off, wid, {
      name: `${entry.op}(${entry.tensor_name})`,
      raw: entry,
      op: entry.op
    });

    /* 立即写回 entry，供 dep-collector 用 */
    entry._cycStart = seg.cycStart;
    entry._cycEnd   = seg.cycEnd;

    return [seg];
  }

  
  /**
   * 决定矩形颜色
   * @param {Object} segment  矩形对应的段对象
   * @returns {string} 颜色字符串，如 '#7b9ce1'
   */
  getColor(segment) {
    const name = segment.name || 'unknown'
    let hash = 0
    for (let i = 0; i < name.length; i++) {
      hash = ((hash << 5) - hash + name.charCodeAt(i)) >>> 0
    }
    const hue = (hash % 1000) / 1000 * 360
    return `hsla(${hue}, ${S}%, ${L}%, 0.75)`
  }

  /**
   * 控制矩形上需显示的标签文字
   * @param {Object} segment 
   * @returns {string} 标签文字
   */
  getLabel(segment){
    const e = segment.raw;
    return `${e.op}  ts${e.timestep}`;
  }

}
