export class LmemParser {
  static FIELDS_WHITELIST = new Set([
    'op_name',
    'op_type',
    'addr',
    'size',
    'timestep_start',
    'timestep_end',
    'lmem_type',
    'hold_in_lmem',
    //'allow_bank_conflict',
    //'one_loop',
    //'shape_secs',
    'status',
    'tag',
    'bank_id',
  ]);

  /**
   * 解析并处理LMEM分配数据
   * @param {string[]} lmemSections 预处理后的 LMEM 日志段落数组
   * @returns {{settings: Object, allocations: LmemAllocation[]}[]}
   */
  parse(lmemSections) {
    const rawGroups = this._groupBySettings(lmemSections);
    return this._processAllocationGroups(rawGroups);
  }

  // 按配置分组原始数据
  _groupBySettings(sections) {
    const groups = [];
    let currentGroup = null;

    sections.forEach(section => {
      const { entry, settings } = this._parseSection(section);
      if(!entry) return;

      // 新配置组检测
      if (!currentGroup || !this._isSameSettings(currentGroup.settings, settings)) {
        currentGroup = { settings, allocations: [] };
        groups.push(currentGroup);
      }

      currentGroup.allocations.push(entry);
    });

    return groups;
  }

  // 解析单个日志段落
  _parseSection(section) {
    const entry = {};
    const settings = {};
    const fieldRegex = /; (\w+) = ([^;]+)/g;
    //const fieldRegex = /;\s*(\w+)\s*=\s*([^;]+)/gi;

    let match;
    while ((match = fieldRegex.exec(section)) !== null) {
      const [_, key, rawValue] = match;
      const value = this._convertValue(key, rawValue.trim());
      

      if (key === 'shape_secs' || key === 'allow_bank_conflict') {
        settings[key] = value;
      }

      if (this.constructor.FIELDS_WHITELIST.has(key)) {
        entry[key] = value;
      }
    }

    return {
      entry: this._validateEntry(entry),
      settings
    };
  }

  // 处理分组数据（包含失败分配的重定位）
  _processAllocationGroups(groups) {
    return groups.map(group => {
      const { settings, allocations } = group;
      const { success, failed } = this._splitByStatus(allocations);

      // 计算成功分配的最大地址
      const maxAddr = success.reduce((max, alloc) => 
        Math.max(max, alloc.addr + alloc.size), 0);

      // 重定位失败分配
      let currentAddr = maxAddr;
      const relocated = failed.map(alloc => {
        const newAlloc = { ...alloc, addr: currentAddr };
        currentAddr += alloc.size;
        return newAlloc;
      });

      // 计算最大时间步
      const maxTimestep = Math.max(
        ...success.map(a => a.timestep_end),
        ...failed.map(a => a.timestep_end)
      );

      return {
        settings,
        allocations: [
          ...success,
          ...relocated
        ].map(alloc => ({
          ...alloc,
          bank_id: (alloc.addr >> 16) & 0xF,
          max_timestep: maxTimestep
        }))
      };
    });
  }

  // 按状态分类
  _splitByStatus(allocations) {
    return allocations.reduce((acc, alloc) => {
      if (alloc.status === 'success') {
        acc.success.push(alloc);
      } else {
        acc.failed.push(alloc);
      }
      return acc;
    }, { success: [], failed: [] });
  }

  // 配置比较
  _isSameSettings(a, b) {
    return ['shape_secs', 'allow_bank_conflict'].every(
      key => JSON.stringify(a[key]) === JSON.stringify(b[key])
    );
  }

  _convertValue(key, value) {
    value = value.trim();   // ← 先去掉首尾空格、换行
    // 布尔型字段
    if (['hold_in_lmem', 'allow_bank_conflict', 'one_loop'].includes(key)) {
      return value === '1' || value.toLowerCase() === 'true';
    }
    
    // 数值型字段
    if (value.startsWith('0x')) return parseInt(value, 16);
    if (!isNaN(value)) return Number(value);
    
    // 数组型字段
    if (key === 'shape_secs') return value.split(',').map(Number);
    
    // 字符串字段（去除引号）
    return value.startsWith('"') && value.endsWith('"') 
      ? value.slice(1, -1) 
      : value;
  }

  _validateEntry(entry) {
    if(entry.tag === 'stamp') return null;

    const requiredFields = [
      'op_name', 'addr', 'size',
      'timestep_start', 'timestep_end',
      'status', 'tag'
    ];
    
    return requiredFields.every(field => field in entry) &&
           entry.tag === 'iteration_result'
      ? entry
      : null;
  }
}



