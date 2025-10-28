import BaseLane from './base-lane.js';

const CYCLE_TO_MS = 1e-6; 
const CYCLE_TO_US = 1e-3;

/**
 * Profile 涉及泳道子类
 * @extends BaseLane
 */
export default class ProfileLane extends BaseLane {
  /**
   * Profile 泳道构造函数, 根据engine区分泳道
   * @param {string} engine 
   */
  constructor(engine) {
    if(engine === 'BD'){
      super('ENGINE_BD');
    }
    else if(engine === 'GDMA'){
      super('ENGINE_GDMA');
    }
    else if(engine === 'LAYER'){
      super('ENGINE_LAYER');
    }
    this.engine = engine; // 'BD' | 'GDMA' | 'LAYER'
  }

  /* -------------- 覆写 -------------- */
/**
  *把单条 entry -> 0 或多个矩形段
  * @param {Array<Object>} entry
  * @return {Array<Object>} 矩形段对象数组
  */
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


  /**
   * 决定矩形颜色
   * @param {Object} segment  矩形对应的段对象
   * @returns {string} 颜色字符串，如 '#7b9ce1'
   * 动态类型 -> 颜色映射
   * 颜色池：20 个柔和半透明色，用完循环
   */
  getColor = (() => {
    /* 1. 柔和色盘（可自由增删） */
    const palette = [
      'rgba(120, 180, 200, 0.75)', // 薄荷蓝
      'rgba(140, 200, 160, 0.75)', // 薄荷绿
      'rgba(160, 160, 210, 0.75)', // 淡紫
      'rgba(200, 180, 160, 0.75)', // 淡棕灰
      'rgba(190, 140, 150, 0.75)', // 淡玫瑰
      'rgba(130, 190, 220, 0.75)', // 清水蓝
      'rgba(150, 210, 180, 0.75)', // 嫩芽绿
      'rgba(170, 150, 200, 0.75)', // 薰衣紫
      'rgba(180, 170, 140, 0.75)', // 米灰
      'rgba(170, 170, 170, 0.75)', // 灰色
      'rgba(255, 180, 120, 0.75)', // 杏橙
      'rgba(180, 220, 240, 0.75)', // 天空蓝
      'rgba(220, 180, 200, 0.75)', // 淡粉
      'rgba(180, 210, 150, 0.75)', // 春芽
      'rgba(150, 180, 220, 0.75)', // 淡钴蓝
      'rgba(240, 200, 160, 0.75)', // 浅驼
      'rgba(160, 200, 220, 0.75)', // 淡湖蓝
      'rgba(200, 160, 180, 0.75)', // 淡玫
      'rgba(220, 220, 180, 0.75)', // 浅米黄
      'rgba(180, 180, 220, 0.75)'  // 淡蓝紫
    ];

    /* 2. 运行期缓存：type -> colorIndex */
    const typeMap = new Map();
    let nextIdx = 0;

    /* 3. 返回真正的 getColor 函数 */
    return function (segment) {
      if (!segment || !segment.type) return 'rgba(123, 156, 225, 0.7)'; // 默认兜底

      const { type } = segment;
      if (typeMap.has(type)) {
        // 已绑定过，直接复用
        return palette[typeMap.get(type)];
      }

      // 新类型：按顺序取色，循环使用
      const colorIndex = nextIdx % palette.length;
      typeMap.set(type, colorIndex);
      nextIdx += 1;
      return palette[colorIndex];
    };
  })();

  /**
   * 控制矩形上需显示的标签文字
   * @param {Object} segment 
   * @returns {string} 标签文字
   */
  getLabel(segment) {
    // return segment.op + ',  ' + (segment.duration * CYCLE_TO_US).toFixed(3) + 'us';

    if(this.engine == 'BD'){
      return 'bd_id=' + segment.bd_id + '\n' + (segment.duration * CYCLE_TO_MS).toFixed(5) + 'ms';
    }
    else if(this.engine == 'GDMA'){
      return 'gdma_id=' + segment.gdma_id + '\n' + (segment.duration * CYCLE_TO_MS).toFixed(5) + 'ms';
    }
    else{
      return segment.type + '\n' + (segment.duration * CYCLE_TO_MS).toFixed(5) + 'ms';
    }
  }


  /**
   * 可覆写函数，控制矩形占据泳道高度比例，默认40%
   * @param {Object} segment 
   * @returns {number} 高度比例 0~1
   */
  getHeightRatio(seg) {
    if(seg.isSL) return super.getHeightRatio(seg) * 0.5; // SL 操作高度减半
    if (seg.bandwidth == null) return super.getHeightRatio(seg); // 0.4
    return super.getHeightRatio(seg)* Math.min(seg.bandwidth / 64, 1);  // 固定峰值带宽：64GB/s
  }

  // tooltipFmt(segment) {
  //   const { op, type, start, end, cost, bd_id, gdma_id, direction, size, bandwidth, info} = segment;
  //   return `
  //     <div style="font-size:13px;line-height:1.4;">
  //       <b>${op}</b> (${type})<br/>
  //       start: ${start}<br/>
  //       end: ${end}<br/>
  //       cost: ${cost}<br/>
  //       ${bd_id != null ? `bd_id: ${bd_id}<br/>` : ''}
  //       ${gdma_id != null ? `gdma_id: ${gdma_id}<br/>` : ''}
  //       ${direction != null ? `direction: ${direction}<br/>` : ''}
  //       ${size != null ? `size: ${size}<br/>` : ''}
  //       ${bandwidth != null ? `bandwidth: ${bandwidth.toFixed(2)}<br/>` : ''}
  //       ${info != null ? `info: ${info}` : ''}
  //     </div>
  //   `;
  // }
}