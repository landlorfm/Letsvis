import BaseLane from './base-lane.js'

const S = 45
const L = 40               // 暗 10 %

export default class GDMALane extends BaseLane {
  constructor() {
    super('GDMA', 'timestep_type')
    // 每个 timestep 已用 cycle 偏移量
    this.innerOffset = new Map() // 仅记录 ts 内已用 cycle
  }


  parseSegments(entry) {
    if (entry.timestep_type !== 'gdma') return []

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

  getLabel(segment){
    const e = segment.raw;
    return `${e.op}  ts${e.timestep}`;
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
}
