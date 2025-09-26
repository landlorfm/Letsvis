// src/core/visualization/lanes/profile-lane.js
import BaseLane from './base-lane.js';

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
      AR: '#5470c6',
      CONV: '#91cc75',
      RQDQ: '#fac858',
      SG: '#ee6666',
      LANE_COPY: '#73c0de',
      LANE_BC: '#3ba272',
      GDMA_TENSOR: '#fc8452',
      GDMA_MATRIX: '#9a60b4'
    };
    return map[segment.type] || '#7b9ce1';
  }

  getLabel(segment) {
    return segment.op.length <= 8 ? segment.op : segment.op.slice(0, 6) + '…';
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