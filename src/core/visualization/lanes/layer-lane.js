import BaseLane from './base-lane.js'

const S = 45
const L = 40            


export default class GDMALane extends BaseLane {
  constructor() {
    super('Layer', 'timestep_type')
    // 每个 timestep 已用 cycle 偏移量
    this.innerOffset = new Map() // 仅记录 ts 内已用 cycle
  }


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


  getColor(segment) {
    const name = segment.name || 'unknown'
    let hash = 0
    for (let i = 0; i < name.length; i++) {
      hash = ((hash << 5) - hash + name.charCodeAt(i)) >>> 0
    }
    const hue = (hash % 1000) / 1000 * 360
    return `hsla(${hue}, ${S}%, ${L}%, 0.75)`
  }

  getLabel(segment){
    const e = segment.raw;
    return `${e.op}  ts${e.timestep}`;
  }

}

// ---- 辅助：HSL→RGB ----
function hslToRgb(h, s, l) {
  s /= 100
  l /= 100
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  let r = 0, g = 0, b = 0
  if (h < 60) { r = c; g = x; b = 0 }
  else if (h < 120) { r = x; g = c; b = 0 }
  else if (h < 180) { r = 0; g = c; b = x }
  else if (h < 240) { r = 0; g = x; b = c }
  else if (h < 300) { r = x; g = 0; b = c }
  else { r = c; g = 0; b = x }
  r = Math.round((r + m) * 255)
  g = Math.round((g + m) * 255)
  b = Math.round((b + m) * 255)
  return `rgb(${r},${g},${b},0.6)`
}