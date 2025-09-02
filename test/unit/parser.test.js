
describe('预处理模块', () => {
  const rawLog = `
    ; action = lmem_assign; tag = other_tag
    ; action = lmem_assign; tag = iteration_result; op_name=test_op
    ; action = add_tpu0_gdma0_ts_field; ts = 14 [ C("tpu.Lut"), "147_Mul" ] [ L("148_Conv_merge", hold_in_lmem = 1)->top.Weight ]
    ; action = timestep_assign; tag = final_result
    ; ts = 1; [ C("op1") ]
  `;

  it('应正确过滤有效段落', () => {
    const { lmemSections, timestepSections } = extractValidSections(rawLog);
    expect(lmemSections).toHaveLength(1);
    expect(lmemSections[0]).toContain('test_op');
    expect(timestepSections).toHaveLength(1);
  });
});

describe('边界情况处理', () => {
  it('应跳过无效的LMEM条目', () => {
    const parser = new LmemParser();
    const result = parser.parse([
      '; action = lmem_assign; tag = iteration_result', // 缺少必要字段
      '; action = lmem_assign; tag = iteration_result; op_name=valid; addr=0x1000; size=1024; timestep_start=1; timestep_end=2'
    ]);
    expect(result).toHaveLength(1);
  });
});