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
      sec.includes('; tag = iteration_result') &&
      !sec.includes('; step = lmem_spec')
  );

  /* 4. timestep  */
  const timestepSections = sections
    .filter(
      sec =>
        sec.includes('; action = timestep_assign') &&
        sec.includes('; tag = final_result')
    )
    .slice(-1);  // 只取最后一个

  return { lmemSections, timestepSections, chip };
}
