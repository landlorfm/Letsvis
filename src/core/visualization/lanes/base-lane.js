import * as echarts from 'echarts';

export default class BaseLane {
  /**
   * @param {string} laneName  泳道显示名
   * @param {string} field     数据里用于区分泳道的字段（ timestep_type）
   */
  constructor(laneName, field) {
    this.laneName = laneName;
    this.field    = field;
    this.categoryIdx = 0;   // 由 lane-factory 或外部注入，子类只读
  }

    /* 静态蓝图区 */
    static tsMaxCycle = new Map();
    static tsLeftEdge = new Map();
    static globalRightEdge = 0;
    static ready = false;
    static tsTicks = []; // 存 {ts, cycle}

  /*  静态方法：全局预扫描 */
  static buildGlobalTimeAxis(entries, slotWidth = 0) {
    const tsSum = new Map();          // ts -> 本 ts 内 cycle 累加和
    const allTs = [...new Set(entries.map(e => e.timestep))].sort((a, b) => a - b);

    // 先累加每个 ts 的真实总 cycle
    entries.forEach(e => {
      const ts = e.timestep;
      tsSum.set(ts, (tsSum.get(ts) || 0) + this.howMuchCycle(e));
    });
    // 找出全局最大累加和
    const maxSum = tsSum.size ? Math.max(...tsSum.values()) : (slotWidth || 1);
    //  所有 ts 统一用 maxSum 做槽宽
    const tsMaxCycle = new Map();
    allTs.forEach(ts => tsMaxCycle.set(ts, maxSum));
    // 空 ts 也用这个统一宽度
    if (slotWidth > maxSum) console.warn('指定 slotWidth 大于真实最大累加和，已忽略');

    // 生成绝对左边缘
    let cursor = 0;
    const leftEdge = new Map();
    allTs.forEach(ts => {
      leftEdge.set(ts, cursor);
      cursor += maxSum;
    });

    // 记录ts刻度
    BaseLane.tsTicks = allTs.map(ts => ({
      ts,
      cycle: leftEdge.get(ts)         // ts 左边缘对应的 cycle 坐标
    }));

    // ⑤ 写回静态蓝图
    BaseLane.tsMaxCycle = tsMaxCycle; // 统一宽度
    BaseLane.tsLeftEdge = leftEdge;
    BaseLane.globalRightEdge = cursor;
    BaseLane.ready = true;
  }

  /* 3. 工具：子类拿绝对坐标 */
  makeSegment(ts, innerOffset, innerWidth, payload) {
    if (!BaseLane.ready) throw new Error('请先调用 BaseLane.buildGlobalTimeAxis()');
    const left = BaseLane.tsLeftEdge.get(ts) + innerOffset;
    return {
      ...payload,
      cycStart: left,
      cycEnd: left + innerWidth,
      duration: innerWidth
    };
  }

  /* 4. 默认实现：一条 entry 占多少 cycle */
  static howMuchCycle(entry) { return entry.cycle || 1; }


  /* ========= 子类可覆写 ========= */
  // 把单条 entry -> 0 或多个矩形段
  parseSegments(entry) { return []; }

  // 决定矩形颜色
  getColor(segment) { return '#7b9ce1'; }

  // tooltip 文字（可选）
  tooltipFmt(segment) { return segment.name; }

  // 矩形上显示的文字
  getLabel(segment) {return '';}   // 默认空，子类决定


  /* ========= 公共模板：吐出 ECharts custom-series ========= */
  toSeriesOption(entries) {
  const segments = entries.flatMap(entry => this.parseSegments(entry));
  this._segments = segments; 
  /* ---------- 空保护 ---------- */
  if (!segments.length) {
    return { type: 'custom', coordinateSystem: 'cartesian2d', name: this.laneName, data: [] };
  }
  /* ---------- 映射 ---------- */
  return {
    type: 'custom',
    coordinateSystem: 'cartesian2d',
    name: this.laneName,
    renderItem: this.#renderItem.bind(this),
    /* 4 维：y 序号, 起始, 结束, 持续时间 */
    encode: { x: [1, 2], y: 0 },
    data: segments.map((s, i) => ({
      // 强制 Number，防止 undefined/NaN
      // 最后一维存下标，读矩形标签文本
      value: [Number(this.categoryIdx), Number(s.cycStart), Number(s.cycEnd), Number(s.duration), i],
      name: s.name,
      itemStyle: { color: this.getColor(s) },
      raw: s
    }))
  };
}

  /* ========= 私有：矩形绘制 ========= */
  #renderItem(params, api) {
  const raw = [api.value(0), api.value(1), api.value(2), api.value(3)];
  const [yIdx, xStart, xEnd] = raw;

  if (!Number.isFinite(yIdx) || !Number.isFinite(xStart) || !Number.isFinite(xEnd)) {
    return { type: 'group' };
  }
  if (!params.coordSys) return { type: 'group' };

  const start = api.coord([xStart, yIdx]);
  const end   = api.coord([xEnd, yIdx]);
  if (isNaN(start[0]) || isNaN(end[0])) return { type: 'group' };

  const height = api.size([0, 1])[1] * 0.6;
  const width  = end[0] - start[0];

  /* ---------- 1. 矩形 ---------- */
  const rectShape = echarts.graphic.clipRectByRect(
    { x: start[0], y: start[1] - height / 2, width, height },
    params.coordSys
  );
  if (!rectShape) return { type: 'group' };

  /* ---------- 2. 文字 ---------- */
  const pad   = 2;                          // 留 2px 边距
  const fontH = 15;                         // 与 fontSize 一致
  const centerX = rectShape.x + rectShape.width / 2;
  const centerY = rectShape.y + rectShape.height / 2;


  const idx       = api.value(4);          // 当前数据在数组里的下标
  const segment   = this._segments[idx];    // 回查原始对象
  const label     = this.getLabel(segment); // 调子类钩子
  const textShape = {
    type: 'text',
    style: {
      text: label,
      x: centerX,
      y: centerY,
      textAlign: 'center',
      textBaseline: 'middle',
      fontSize: fontH,
      fill: '#fff',
      // 关键：限制宽度并自动截断
      width: rectShape.width * 0.9,
      overflow: 'truncate',   // 超出用 …
      ellipsis: '…'
    }
  }


  return {
    type: 'group',
    children: [
      // 矩形
      { type: 'rect', 
        shape: rectShape, 
        style: api.style() 
      },
      // 文字
      textShape,
    ]
  };
}
}