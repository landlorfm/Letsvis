export class TimestepParser {
  /**
   * @param {string[]} timestepSections 预处理后的Timestep段落
   * @returns {TimestepAssignment[]}
   */
  parse(timestepSections) {
    if (timestepSections.length === 0) return [];
    
    const section = timestepSections[0];
    const lines = section.split('\n')
      .filter(line => line.includes('; ts ='));
    
    return lines.map(line => {
      try {
        return this._parseTimestepLine(line);
      } catch (e) {
        console.warn('解析timestep行失败:', e.message);
        return null;
      }
    }).filter(Boolean);
  }

  _parseTimestepLine(line) {
    const tsMatch = line.match(/; ts = (\d+);/);
    if (!tsMatch) throw new Error('无效的时间步格式');
    
    return {
      ts: parseInt(tsMatch[1]),
      compute: this._extractOperations(line, 'C'), // 计算操作
      loads: this._extractOperations(line, 'L'),   // 加载操作
      stores: this._extractOperations(line, 'S')   // 存储操作
    };
  }

  _extractOperations(line, type) {
    if (type === 'C') {
      // 捕获两个括号里的字符串：C("...") 和 "..."
      const regex = /C\("([^"]+)"\)[^"]*"([^"]+)"/g;
      return [...line.matchAll(regex)].map(([_, id1, id2]) => ({
        id: `${id2}`,   // 合并记录 `${id1} (${id2})`
        type: 'compute',
        operation: `${id1}`
      }));
    }
    // type 为 L或S
    const regex = new RegExp(`${type}\\("([^"]+)", hold_in_lmem = (\\d)\\)->([^,\\]]+)`, 'g');
    return [...line.matchAll(regex)].map(([_, id, hold, target]) => ({
      id,
      hold_in_lmem: parseInt(hold),
      target,
      type: type === 'C' ? 'compute' : type.toLowerCase()
    }));
  }
}