export class TimestepParser {
  static FIELDS_WHITELIST = new Set([
    'timestep',
    'timestep_type',   // gdma / layer
    'op',
    'tensor_name',
    'concerning_op',
    'concerning_op_name',
    'cycle',
    'shape_secs'
  ]);

  constructor() {
    this.maxTimestepGlobal = 0;
  }

  getGlobalMaxTimestep() {
    return this.maxTimestepGlobal;
  }

  /**
   * 解析 timestep 日志段落
   * @param {string[]} timestepSections 预处理后且已过滤的段落数组
   * @returns {{settings:Object, entries:Object[]}[]}
   *        每个 setting 对应一个 { settings:{shape_secs:[...]}, entries:[...] }
   */
  parse(timestepSections) {
    const rawGroups = this._groupBySettings(timestepSections);
    return this._processGroups(rawGroups);
  }

  /* ---- 内部 ---- */

  _groupBySettings(sections) {
    const groups = [];          // [{settings, entries:[]}]
    let cur = null;

    sections.forEach(sec => {
      const { entry, settings } = this._parseSection(sec);
      if (!entry) return;       // 无效行直接丢弃

      if (!cur || !this._isSameSettings(cur.settings, settings)) {
        cur = { settings, entries: [] };
        groups.push(cur);
      }
      cur.entries.push(entry);
    });
    return groups;
  }

  _parseSection(sec) {
    const entry = {};
    const settings = {};
    const regex = /;\s*(\w+)\s*=\s*([^;]+)/g;

    let m;
    while ((m = regex.exec(sec)) !== null) {
      const [, k, raw] = m;
      const v = this._convertValue(k, raw.trim());

      if (k === 'shape_secs') settings[k] = v;
      if (this.constructor.FIELDS_WHITELIST.has(k)) entry[k] = v;
    }

    // 计算全局最大 timestep
    if (entry.timestep != null) {
      this.maxTimestepGlobal = Math.max(this.maxTimestepGlobal, entry.timestep);
    }

    return { entry: this._validate(entry), settings };
  }

  _validate(entry) {
    // 只保留完整且符合预期的行
    const must = ['timestep', 'timestep_type', 'op', 'cycle'];
    return must.every(k => k in entry) ? entry : null;
  }

  _isSameSettings(a, b) {
    return JSON.stringify(a.shape_secs) === JSON.stringify(b.shape_secs);
  }

  _processGroups(groups) {
    // 目前无需重定位，直接返回
    return groups.map(g => ({
      settings: g.settings,
      entries:  g.entries
    }));
  }

  _convertValue(k, v) {
    if (k === 'shape_secs') return v.split(',').map(Number);
    if (!isNaN(v)) return Number(v);
    // 去引号
    return v.startsWith('"') && v.endsWith('"') ? v.slice(1, -1) : v;
  }
}