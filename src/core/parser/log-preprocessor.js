/**
 * 从原始日志中提取有效段落
 * @param {string} rawLog 原始日志文本
 * @returns {{
 *   lmemSections: string[],
 *   timestepSections: string[],
 *   chip: Object
 * }}
 */
export function extractValidSections(rawLog) {
  const sections = rawLog.split(/(?=; action = \w+)/g);

  /* 1. 芯片规格段落（只取第一条） */
  const chipSection = sections.find(sec =>
    sec.includes('; action = lmem_assign') && sec.includes('; step = lmem_spec')
  );

  /* 2. 解析芯片字段 */
  const chip = {};
  if (chipSection) {
    const regex = /;\s*(\w+)\s*=\s*([^;]+)/gi;
    let m;
    while ((m = regex.exec(chipSection)) !== null) {
      const [, key, val] = m;
      if (['lmem_bytes', 'lmem_banks', 'lmem_bank_bytes'].includes(key)) {
        chip[key] = Number(val.trim());
      }
    }
    console.log('[extractValidSections] 芯片信息:', chip);
  }

  /* 3. lmem_assign + iteration_result 段落（不含芯片段落） */
  const lmemSections = sections.filter(
    sec =>
      sec.includes('; action = lmem_assign') &&
      sec.includes('; tag = iteration_result')
        //  &&
  //     !sec.includes('; step = lmem_spec')
  );

  /* 4. timestep */
  let timestepSections = [];
  const startIndex = sections.findIndex(sec =>
    sec.includes('; action = timestep_cycle; debug_range = given;')
  );

    if (startIndex !== -1) {
    // 提取候选段落并进行去重,  从 startIndex 开始，提取所有后续符合条件的条目
    const candidates = sections
      .slice(startIndex)
      .filter(sec =>
        sec.includes('; action = timestep_cycle;') &&
        sec.includes('; step = timestep_cycle;') &&
        sec.includes('; tag = result;')
      );
    
    // 文本完全一致去重（保留首次出现顺序）
    const seen = new Set();
    timestepSections = [];
    for (const sec of candidates) {
      if (!seen.has(sec)) {
        seen.add(sec);
        timestepSections.push(sec);
      }
    }
  }

return { lmemSections, timestepSections, chip };

}
