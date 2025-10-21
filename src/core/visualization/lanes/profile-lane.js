import BaseLane from './base-lane.js';

const CYCLE_TO_MS = 1e-6; 
const CYCLE_TO_US = 1e-3;

export default class ProfileLane extends BaseLane {
  constructor(engine) {
    super(engine === 'BD' ? 'ENGINE_BD' : 'ENGINE_GDMA', 'engine');
    this.engine = engine; // 'BD' | 'GDMA'
  }

//   /* -------------- 覆写 -------------- */
// parseSegments(entry) {
//   if (entry.engine !== this.engine) return [];
//   const { start, cost, op, type } = entry;
//   if (start == null || cost == null) return [];

//   // 直接用绝对坐标
//   return [
//     this.makeSegmentAbsolute(start, cost, {
//       name: `${op}|${type}`,
//       ...entry
//     })
//   ];
// }

/* -------------- 覆写 -------------- */
parseSegments(entry) {
  // 统一接口处理两种数据格式
  const engine = entry.engine;
  const start = entry.start // || entry.timestep;  
  const cost = entry.cost // || entry.cycle;     
  const op = entry.op;
  const type = entry.type;
  
  if (engine !== this.engine) return [];
  if (start == null || cost == null) return [];

  // 直接用绝对坐标
  const segment = this.makeSegmentAbsolute(start, cost, {
    name: `${op}|${type}`,
    // 复制所有字段，确保两种格式都支持
    op: op,
    type: type,
    engine: engine,
    start: start,
    cost: cost,
    end: start + cost,
    bd_id: entry.bd_id,
    gdma_id: entry.gdma_id,
    direction: entry.direction,
    size: entry.size,
    bandwidth: entry.bandwidth,
    // 保留原始引用信息
    _index: entry._index,
    _isOptimized: entry._isOptimized
  });

  return [segment];
}

  getColor(segment) {
    const map = {
      AR:             'rgba(120, 180, 200, 0.75)',  // 薄荷蓝
      CONV:           'rgba(140, 200, 160, 0.75)',  // 薄荷绿
      RQDQ:           'rgba(160, 160, 210, 0.75)',  // 淡紫
      PorD:           'rgba(200, 180, 160, 0.75)',  // 淡棕灰 
      SG:             'rgba(190, 140, 150, 0.75)',  // 淡玫瑰
      LANE_COPY:      'rgba(130, 190, 220, 0.75)',  // 清水蓝
      LANE_BC:        'rgba(150, 210, 180, 0.75)',  // 嫩芽绿
      GDMA_TENSOR:    'rgba(170, 150, 200, 0.75)',  // 薰衣紫
      GDMA_MATRIX:    'rgba(180, 170, 140, 0.75)',   // 米灰
      GDMA_BROADCAST: 'rgba(170, 170, 170, 0.75)'    // 灰色
    }
    return map[segment.type] || 'rgba(123, 156, 225, 0.7)' // 默认 #7b9ce1
  }

  getLabel(segment) {
    //return segment.op + ',  ' + (segment.duration * CYCLE_TO_MS).toFixed(5) + 'ms';
    // return segment.op + ',  ' + (segment.duration * CYCLE_TO_US).toFixed(3) + 'us';

    if(this.engine == 'BD'){
      return 'bd_id=' + segment.bd_id + '\n' + (segment.duration * CYCLE_TO_MS).toFixed(5) + 'ms';
    }
    else{
      return 'gdma_id=' + segment.gdma_id + '\n' + (segment.duration * CYCLE_TO_MS).toFixed(5) + 'ms';
    }
  }


  getHeightRatio(seg) {
    if (seg.bandwidth == -1) return super.getHeightRatio(seg); // 0.4
    return 0.2 + 0.7 * Math.min(seg.bandwidth / 200, 1);
  }

  tooltipFmt(segment) {
    const { op, type, start, end, cost, bd_id, gdma_id, direction, size, bandwidth } = segment;
    return `
      <div style="font-size:13px;line-height:1.4;">
        <b>${op}</b> (${type})<br/>
        start: ${start}<br/>
        end: ${end}<br/>
        cost: ${cost}<br/>
        ${bd_id != null ? `bd_id: ${bd_id}<br/>` : ''}
        ${gdma_id != null ? `gdma_id: ${gdma_id}<br/>` : ''}
        ${direction != null ? `direction: ${direction}<br/>` : ''}
        ${size != null ? `size: ${size}<br/>` : ''}
        ${bandwidth != null ? `bandwidth: ${bandwidth.toFixed(2)}<br/>` : ''}
      </div>
    `;
  }
}