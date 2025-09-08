import { extractValidSections } from '@/core/parser/log-preprocessor.js';
import { LmemParser }           from '@/core/parser/lmem-parser.js';
import { TimestepParser }       from '@/core/parser/timestep-parser.js';
import { MemoryStatistics }     from '@/core/parser/memory-statistics.js';

self.onmessage = async (e) => {
  const rawLog = e.data;
  try {
    // 输入验证
    if (!rawLog || typeof rawLog !== 'string') {
      throw new Error('Invalid input: rawLog must be a non-empty string');
    }

    // 提取有效段（分离LMEM和Timestep）
    const { lmemSections, timestepSections, chip } = extractValidSections(rawLog);
    
    // 独立解析结果对象
    const results = {
      lmem: null,
      summary: null,
      timestep: null,
      chip: chip || null
    };
    
    // 独立有效性标志
    const valid = {
      lmem: false,
      summary: false,
      timestep: false
    };

    // 1. 独立解析LMEM数据
    if (lmemSections.length) {
      try {
        const lmemParser = new LmemParser();
        results.lmem = lmemParser.parse(lmemSections);
        valid.lmem = true;
        
        // 2. 独立计算Summary
        if (results.lmem.length) {
          const memoryStats = new MemoryStatistics();
          memoryStats.setLmemData(results.lmem, lmemParser.getGlobalMaxTimestep());
          const summaryCache = memoryStats.calculateAllStatistics();
          results.summary = summaryCache;
          valid.summary = true;
          
          // 将芯片信息合并到第一个settings组
          if (chip) {
            Object.assign(results.lmem[0].settings, chip);
          }
        }
      } catch (lmemErr) {
        console.error('[Worker] LMEM解析错误:', lmemErr);
      }
    }

    // 3. 独立解析Timestep数据
    if (timestepSections.length) {
      try {
        const timestepParser = new TimestepParser();
        results.timestep = timestepParser.parse(timestepSections);
        valid.timestep = true;
      } catch (timestepErr) {
        console.error('[Worker] Timestep解析错误:', timestepErr);
      }
    }

    // 检查至少有一个有效部分
    if (!valid.lmem && !valid.timestep) {
      throw new Error('No valid data sections found in the log file');
    }

    // 返回结果和有效性状态
    self.postMessage({
      ...results,
      valid,
      success: true
    });
    
  } catch (err) {
    console.error('[Worker]', err);
    self.postMessage({ 
      error: err.message,
      success: false
    });
  }
};
