// 引入你的三段式解析器
import { extractValidSections } from '@/core/parser/log-preprocessor.js';
import { LmemParser }           from '@/core/parser/lmem-parser.js';
import { TimestepParser }       from '@/core/parser/timestep-parser.js';
import { associateData }        from '@/core/parser/log-associator.js';

self.onmessage = async (e) => {
  const rawLog = e.data;
  try {
    // 输入验证
    if (!rawLog || typeof rawLog !== 'string') {
      throw new Error('Invalid input: rawLog must be a non-empty string');
    }

    // 提取有效段
    const { lmemSections, timestepSections, chip } = extractValidSections(rawLog);
    // 检查段是否有效
    if (!lmemSections.length || !timestepSections.length) {
      throw new Error('No valid sections found in the log file');
    }

    // 详细解析
    const lmemParser     = new LmemParser();
    const timestepParser = new TimestepParser();
    const lmemData       = lmemParser.parse(lmemSections);
    const timestepData   = timestepParser.parse(timestepSections);

    // 把芯片字段塞进 settings
    if (lmemData.length && chip) {
    Object.assign(lmemData[0].settings, chip);
    }
    console.log('[Worker] lmemData after chip merge:', lmemData);

    // 解析结果验证
    if ( !lmemData || !timestepData) {
      throw new Error('Parser returned invalid data');
    }

    // 关联并生成 summary
    const resultAsc = associateData(lmemData[0].allocations, timestepData);
    //console.log('[Worker] Associated summary data:', resultAsc);

    // 打包返回
    self.postMessage({
      lmem:     lmemData,          // 外层数组，每项 {chip, settings, allocations}
      timestep: timestepData,      // timestep 数组
      summary:  resultAsc,          // summary 数组
    });
  } catch (err) {
    console.error('[Worker]', err);
    self.postMessage({ error: err.message });
  }
};


// // ------------- 调试 -------------
// // 控制台打印数据
// self.onmessage = async (e) => {
//   const rawLog = e.data;
//   try {
//     const { lmemSections, timestepSections, chip } = extractValidSections(rawLog);
//     console.log('[Worker] lmemSections:', lmemSections);
//     console.log('[Worker] timestepSections:', timestepSections);
//     console.log('[Worker] chip:', chip);

//     const lmemParser = new LmemParser();
//     const lmemData   = lmemParser.parse(lmemSections);
//     // 把芯片字段塞进 settings
//     if (lmemData.length && chip) {
//     Object.assign(lmemData[0].settings, chip);
//     }
//     console.log('[Worker] lmemData:', lmemData);

//     const timestepParser = new TimestepParser();
//     const timestepData   = timestepParser.parse(timestepSections);
//     console.log('[Worker] timestepData:', timestepData);

//     const summary = associateData(lmemData, timestepData);
//     console.log('[Worker] summary:', summary);

//     self.postMessage({ lmem: lmemData, timestep: timestepData, summary });
//   } catch (err) {
//     console.error('[Worker]', err);
//     self.postMessage({ error: err.message });
//   }
// };