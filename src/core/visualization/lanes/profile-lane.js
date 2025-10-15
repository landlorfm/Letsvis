import BaseLane from './base-lane.js';

const CYCLE_TO_MS = 1e-6; 

export default class ProfileLane extends BaseLane {
  constructor(engine) {
    super(engine === 'BD' ? 'ENGINE_BD' : 'ENGINE_GDMA', 'engine');
    this.engine = engine; // 'BD' | 'GDMA'
  }

  /* -------------- 覆写 -------------- */
parseSegments(entry) {
  if (entry.engine !== this.engine) return [];
  const { start, cost, op, type } = entry;
  if (start == null || cost == null) return [];

  // 直接用绝对坐标
  return [
    this.makeSegmentAbsolute(start, cost, {
      name: `${op}|${type}`,
      ...entry
    })
  ];
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
    //return segment.op.length <= 10 ? segment.op : segment.op.slice(0, 6) + ' ' +  (segment.duration * CYCLE_TO_MS).toFixed(5) + 'ms';
    return segment.op + ',  ' + (segment.duration * CYCLE_TO_MS).toFixed(5) + 'ms';
  }


  getHeightRatio(seg) {
    if (seg.bandwidth == null) return super.getHeightRatio(seg); // 0.4
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