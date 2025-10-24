#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
单日志文件解析，输出固定格式 json 文件以及 profile 导出表
usage:
    python log_parser.py input_dir/  -o output_dir/ 
    其中 input_dir/ 包含需可视化的日志文件，如：LayerGroup 日志文件， compiler_profie_(), xxxx.bmodel.json 等
"""
import re
import json
import argparse
from typing import List, Dict, Any, Tuple, Optional
from pathlib import Path
import collections

# ----------------------------------------------------------
# 1. 日志分段
# ----------------------------------------------------------
def extract_valid_sections(raw_log: str) -> Dict[str, Any]:
    marker_re = re.compile(
        r'^-{20,}\s*\n'          # 第1行：20+ 个 -
        r'.*start time.*$',       # 第2行：包含 start time
        re.MULTILINE
    )
    m = marker_re.search(raw_log)
    if m:
        split_pos    = m.start()
        compute_text = raw_log[:split_pos]
        profile_text = raw_log[split_pos:]
    else:
        compute_text = raw_log
        profile_text = ""

    compute_secs = re.split(r'(?=; action = \w+)', compute_text)
    lmem_sections = [
        s for s in compute_secs
        if '; action = lmem_assign' in s and '; tag = iteration_result' in s
    ]
    timestep_sections = []
    start_idx = next((
        i for i, s in enumerate(compute_secs)
        if '; action = timestep_cycle; debug_range = given;' in s
    ), -1)
    if start_idx != -1:
        seen = set()
        for s in compute_secs[start_idx:]:
            if (
                '; action = timestep_cycle;' in s
                and '; step = timestep_cycle;' in s
                and '; tag = result;' in s
                and s not in seen
            ):
                seen.add(s)
                timestep_sections.append(s)

    chip_section = next((
        s for s in compute_secs
        if '; action = lmem_assign' in s and '; step = lmem_spec' in s
    ), None)
    chip = {}
    if chip_section:
        for m in re.finditer(r';\s*(\w+)\s*=\s*([^;]+)', chip_section):
            key, val = m.group(1), m.group(2).strip()
            if key in {'lmem_bytes', 'lmem_banks', 'lmem_bank_bytes'}:
                chip[key] = int(val)

    return {
        'lmemSections': lmem_sections,
        'timestepSections': timestep_sections,
        'profileText': profile_text,
        'chip': chip or None
    }

FIELDS_WHITELIST_LMEM = {
    'op_name', 'op_type', 'addr', 'size', 'timestep_start', 'timestep_end',
    'lmem_type', 'hold_in_lmem', 'status', 'tag', 'bank_id'
}

# ----------------------------------------------------------
# 2. LMEM 解析
# ----------------------------------------------------------
class LmemParser:
    def __init__(self,chip: Dict = None):
        self.max_timestep_global = 0
        self.chip = chip or {}

    def get_global_max_timestep(self) -> int:
        return self.max_timestep_global

    # ---- 主入口 ----
    def parse(self, sections: List[str]) -> List[Dict[str, Any]]:
        raw_groups = self._group_by_settings(sections)
        return self._process_allocation_groups(raw_groups)

    # ---- 内部 ----
    def _group_by_settings(self, sections: List[str]):
        groups = []
        cur = None
        for sec in sections:
            entry, settings = self._parse_section(sec)
            if not entry:
                continue
            if not cur or not self._is_same_settings(cur['settings'], settings):
                cur = {'settings': settings, 'allocations': []}
                groups.append(cur)
            cur['allocations'].append(entry)
        return groups

    def _parse_section(self, sec: str) -> Tuple[Optional[Dict], Dict]:
        entry, settings = {}, {}
        for m in re.finditer(r';\s*(\w+)\s*=\s*([^;]+)', sec):
            key, raw = m.group(1), m.group(2).strip()
            val = self._convert_value(key, raw)
            if key == 'shape_secs' or key == 'allow_bank_conflict':
                settings[key] = val
            if key in FIELDS_WHITELIST_LMEM:
                entry[key] = val
        settings.update(self.chip)  # 合并芯片规格
        valid_entry = self._validate_entry(entry)
        return valid_entry, settings

    def _process_allocation_groups(self, groups):
        out = []
        for g in groups:
            settings, allocs = g['settings'], g['allocations']
           # print(f"settings: {settings}")
            success, failed = self._split_by_status(allocs)
            max_addr = max((a['addr'] + a['size'] for a in success), default=0)
            current = max_addr
            relocated = []
            for a in failed:
                new_a = a.copy()
                new_a['addr'] = current
                current += a['size']
                relocated.append(new_a)
            merged = success + relocated
            max_ts = max((a['timestep_end'] for a in merged), default=0)
            self.max_timestep_global = max(self.max_timestep_global, max_ts)
            lmem_bank_bytes = settings.get('lmem_bank_bytes') 
            # 不回卷，纯递增
            out.append({
                'settings': settings,
                'allocations': [
                    {**a,
                        'bank_id': a['addr'] // lmem_bank_bytes,
                        'max_timestep': max_ts}
                    for a in merged
                ]
            })
        return out

    # ---- 工具 ----
    def _split_by_status(self, allocs):
        success, failed = [], []
        for a in allocs:
            (success if a.get('status') == 'success' else failed).append(a)
        return success, failed

    def _is_same_settings(self, a: Dict, b: Dict) -> bool:
        return (json.dumps(a.get('shape_secs')) ==
                json.dumps(b.get('shape_secs')) and
                json.dumps(a.get('allow_bank_conflict')) ==
                json.dumps(b.get('allow_bank_conflict')))

    def _convert_value(self, key: str, val: str):
        val = val.strip()
        if key in {'hold_in_lmem', 'allow_bank_conflict', 'one_loop'}:
            return val == '1' or val.lower() == 'true'
        if val.startswith('0x'):
            return int(val, 16)
        if val.isdigit() or (val.startswith('-') and val[1:].isdigit()):
            return int(val)
        if key == 'shape_secs':
            return [int(x) for x in val.split(',') if x]
        if val.startswith('"') and val.endswith('"'):
            return val[1:-1]
        return val

    def _validate_entry(self, entry: Dict):
        if entry.get('tag') != 'iteration_result':
            return None
        required = {'op_name', 'addr', 'size',
                    'timestep_start', 'timestep_end', 'status', 'tag'}
        return entry if required.issubset(entry) else None

# ----------------------------------------------------------
# 3. Timestep 解析
# ----------------------------------------------------------
FIELDS_WHITELIST_TS = {
    'timestep', 'timestep_type', 'op', 'tensor_name',
    'concerning_op', 'concerning_op_name', 'cycle', 'shape_secs'
}


class TimestepParser:
    def __init__(self):
        self.max_timestep_global = 0

    def get_global_max_timestep(self) -> int:
        return self.max_timestep_global

    def parse(self, sections: List[str]) -> List[Dict[str, Any]]:
        groups = self._group_by_settings(sections)
        return [{'settings': g['settings'], 'entries': g['entries']} for g in groups]

    def _group_by_settings(self, sections):
        groups, cur = [], None
        for sec in sections:
            entry, settings = self._parse_section(sec)
            if not entry:
                continue
            if not cur or not self._is_same_settings(cur['settings'], settings):
                cur = {'settings': settings, 'entries': []}
                groups.append(cur)
            cur['entries'].append(entry)
        return groups

    def _parse_section(self, sec: str):
        entry, settings = {}, {}
        for m in re.finditer(r';\s*(\w+)\s*=\s*([^;]+)', sec):
            k, raw = m.group(1), m.group(2).strip()
            v = self._convert_value(k, raw)
            if k == 'shape_secs':
                settings[k] = v
            if k in FIELDS_WHITELIST_TS:
                entry[k] = v
        if entry.get('timestep') is not None:
            self.max_timestep_global = max(self.max_timestep_global,
                                           int(entry['timestep']))
        if entry.get('cycle') is not None:
            entry['_cycStart'] = 0
            entry['_cycEnd'] = int(entry['cycle'])
        valid_entry = self._validate(entry)
        return valid_entry, settings

    def _validate(self, entry: Dict):
        must = {'timestep', 'timestep_type', 'op', 'cycle'}
        return entry if must.issubset(entry) else None

    def _is_same_settings(self, a: Dict, b: Dict) -> bool:
        return json.dumps(a.get('shape_secs')) == json.dumps(b.get('shape_secs'))

    def _convert_value(self, key: str, val: str):
        if key == 'shape_secs':
            return [int(x) for x in val.split(',') if x]
        if val.isdigit() or (val.startswith('-') and val[1:].isdigit()):
            return int(val)
        if val.startswith('"') and val.endswith('"'):
            return val[1:-1]
        return val

# ----------------------------------------------------------
#  4. MemoryStatistics 
# ----------------------------------------------------------
class MemoryStatistics:
    def __init__(self):
        self.lmem_groups = []
        self.ts_counts = 0
        self.summary_cache = None

    def set_lmem_data(self, lmem_groups: List[Dict], ts_counts: int):
        self.lmem_groups = lmem_groups
        self.ts_counts = ts_counts
        self.summary_cache = None

    def calculate_all_statistics(self) -> Dict[str, Any]:
        if self.summary_cache:
            return self.summary_cache
        if not self.lmem_groups:
            return {'groups': [], 'globalSummary': {}}

        groups_stats = [self._calc_for_group(g) for g in self.lmem_groups]
        global_summary = self._global_summary(groups_stats)
        self.summary_cache = {'groups': groups_stats,
                              'globalSummary': global_summary}
        return self.summary_cache

    # ---- 内部 ----
    def _calc_for_group(self, group: Dict):
        settings, allocs = group['settings'], group['allocations']
        max_ts = max(a['max_timestep'] for a in allocs) if allocs else 0
        step_stats = [self._calc_step(allocs, step, settings)
                      for step in range(max_ts + 1)]
        summary = self._group_summary(step_stats, allocs)
        return {'settings': settings,
                'stepStatistics': step_stats,
                'summary': summary}

    def _calc_step(self, allocs, step: int, settings: Dict):
        step_allocs = [a for a in allocs if self._is_active(a, step)]
        by_bank = {}
        for a in step_allocs:
            bank_id = a.get('bank_id', 0)
            by_bank.setdefault(bank_id, []).append(a)
        total_mem = self._total_memory(step_allocs)
        used_mem = self._used_memory(step_allocs)
        return {
            'step': step,
            'settingsKey': self._settings_key(settings),
            'totalMemory': total_mem,
            'usedMemory': used_mem,
            'freeMemory': max(0, total_mem - used_mem),
            'memoryUsagePercentage': (used_mem / total_mem * 100) if total_mem else 0,
            'peakMemory': max((a['size'] for a in step_allocs), default=0),
            'allocationCount': len(step_allocs),
            'activeAllocations': len(step_allocs),
            'bankStatistics': {
                bid: {
                    'usedMemory': self._used_memory(bank),
                    'allocationCount': len(bank),
                    'averageAllocationSize': self._avg_size(bank),
                    'largestAllocation': max((a['size'] for a in bank), default=0)
                }
                for bid, bank in by_bank.items()
            },
            'detailedStats': self._detailed(step_allocs)
        }

    def _group_summary(self, step_stats, allocs):
        succ = [a for a in allocs if a.get('status') == 'success']
        fail = [a for a in allocs if a.get('status') != 'success']
        total = len(allocs)
        return {
            'totalAllocations': total,
            'successfulAllocations': len(succ),
            'failedAllocations': len(fail),
            'successRate': (len(succ) / total * 100) if total else 0,
            'maxMemoryUsage': max((s['usedMemory'] for s in step_stats), default=0),
            'averageMemoryUsage': sum(s['usedMemory'] for s in step_stats) / len(step_stats) if step_stats else 0,
            'peakAllocationCount': max(s['allocationCount'] for s in step_stats) if step_stats else 0,
            'totalMemoryFootprint': self._total_memory(allocs)
        }

    def _global_summary(self, groups_stats):
        if not groups_stats:
            return {}
        max_mem = max(max(s['usedMemory'] for s in g['stepStatistics'])
                      for g in groups_stats)
        total_allocs = sum(g['summary']['totalAllocations'] for g in groups_stats)
        rates = [g['summary']['successRate'] for g in groups_stats]
        avg_rate = sum(rates) / len(rates) if rates else 0
        return {
            'totalGroups': len(groups_stats),
            'maxMemoryUsage': max_mem,
            'totalAllocations': total_allocs,
            'avgSuccessRate': avg_rate
        }

    # ---- 工具 ----
    def _is_active(self, a: Dict, step: int) -> bool:
        if a.get('hold_in_lmem'):
            return True
        start, end = a['timestep_start'], a['timestep_end']
        if start <= end:
            return start <= step <= end
        return (start <= step <= self.ts_counts) or (0 <= step <= end)

    def _total_memory(self, allocs):
        return max((a['addr'] + a['size'] for a in allocs), default=0)

    def _used_memory(self, allocs):
        return sum(a['size'] for a in allocs)

    def _avg_size(self, allocs):
        return sum(a['size'] for a in allocs) / len(allocs) if allocs else 0

    def _detailed(self, allocs):
        succ = [a for a in allocs if a.get('status') == 'success']
        total = len(allocs)
        return {
            'successfulAllocations': len(succ),
            'failedAllocations': total - len(succ),
            'successRate': (len(succ) / total * 100) if total else 0,
            'averageAllocationSize': self._avg_size(allocs),
            'memoryFragmentation': self._fragmentation(allocs),
            'allocationTypes': self._types(allocs)
        }

    def _fragmentation(self, allocs):
        if len(allocs) < 2:
            return 0
        sorted_allocs = sorted(allocs, key=lambda x: x['addr'])
        gap = 0
        for prev, cur in zip(sorted_allocs, sorted_allocs[1:]):
            gap += max(0, cur['addr'] - (prev['addr'] + prev['size']))
        total = self._total_memory(allocs)
        return (gap / total * 100) if total else 0

    def _types(self, allocs):
        cnt = {}
        for a in allocs:
            t = a.get('lmem_type', 'unknown')
            cnt[t] = cnt.get(t, 0) + 1
        return cnt

    def _settings_key(self, settings: Dict) -> str:
        return json.dumps({
            'allow_bank_conflict': settings.get('allow_bank_conflict'),
            'shape_secs': settings.get('shape_secs')
        }, sort_keys=True)
    
FIELDS_WHITELIST_PROFILE = {
    'op', 'type', 'start', 'end', 'cost', 'bd_id', 'gdma_id',
    'direction', 'size', 'bandwidth'
}

# ----------------------------------------------------------
# 5. bmodel.json 解析 + Layer 信息生成
# ----------------------------------------------------------
OpNode = collections.namedtuple(
    'OpNode',
    'file_line core_id name bd_start bd_count gdma_start gdma_count '
    'operands results is_local'
)

def parse_bmodel(path: Path) -> List[OpNode]:
    """安全解析 bmodel.json，返回 OpNode 列表"""
    if not path.exists() or path.stat().st_size == 0:
        return []
    try:
        content = path.read_text(encoding='utf-8-sig').strip()
        if content.startswith('[') and content.endswith(',]'):
            content = content[:-2] + ']'
        data = json.loads(content)
    except Exception:
        return []
    ops = []
    for node in data:
        if not isinstance(node, dict) or not node.get('opcode', '').startswith('tpu.'):
            continue
        fl  = node.get('file-line', 'N/A')
        core = node.get('core_id', -1)
        name = node['opcode'].split('.')[-1]
        before = node.get('tiu_dma_id(before)', [0, 0])
        after  = node.get('tiu_dma_id(after)',  [0, 0])
        if len(before) < 2: before = [0, 0]
        if len(after)  < 2: after  = [0, 0]
        bd_start, gdma_start = before[0]+1, before[1]+1
        bd_count, gdma_count = after[0] - before[0], after[1] - before[1]
        ops.append(OpNode(fl, core, name, bd_start, bd_count,
                          gdma_start, gdma_count,
                          node.get('operands', []),
                          node.get('results', []),
                          node.get('is_local', False)))
    return ops

def get_tensor_info(tensor):
    """提取张量的形状和数据类型"""
    # 从shape字段提取形状信息（整数列表）
    shape = tensor.get("shape", [])
    shape_str = "x".join(str(dim) for dim in shape) if shape else ""
    
    # 从memory_type字段提取数据类型
    dtype = "UNKNOWN"
    memory_type = tensor.get("memory_type", "").lower()
    
    # 从memory_type中提取基础数据类型
    if "f32" in memory_type: dtype = "FP32"
    elif "f16" in memory_type: dtype = "FP16"
    elif "si8" in memory_type: dtype = "INT8"
    elif "ui8" in memory_type: dtype = "UINT8"
    elif "i16" in memory_type: dtype = "INT16"
    elif "bf16" in memory_type: dtype = "BF16"
    elif "i32" in memory_type: dtype = "INT32"
    
    return shape_str, dtype

def build_info(op: OpNode) -> str:
    """拼 HTML 片段"""
    def fmt_tensor(t):
        shape, dtype = get_tensor_info(t)
        return  f"tensor_id=NaN [{shape}] {dtype}"
    ins  = '<br>==ins==<br>'  + '<br>'.join(fmt_tensor(t) for t in op.operands)  if op.operands else ''
    outs = '<br>==outs==<br>' + '<br>'.join(fmt_tensor(t) for t in op.results)   if op.results  else ''
    local = 'local_layer' if op.is_local else 'global_layer'
    return f"<br>{local}{ins}{outs}<br>" #========<br>feature_size=0<br>weight_size=0<br>total_size=0"

class LayerExtractor:
    """根据已解析的 BD/GDMA entries + bmodel 生成 layer 条目（对象格式）"""
    def __init__(self, bmodel_path: Path):
        self.ops = parse_bmodel(bmodel_path)
        self.lookup = {(op.file_line, op.name): op for op in self.ops}

    def make_layer_entries(
        self,
        bd_entries: List[Dict[str, Any]],
        gdma_entries: List[Dict[str, Any]],
        core_id: int,
        tiu_mhz: int = 1000,
    ) -> List[Dict[str, Any]]:
        bd_map   = {e['bd_id']:  e for e in bd_entries  if 'bd_id'  in e}
        gdma_map = {e['gdma_id']: e for e in gdma_entries if 'gdma_id' in e}
        layer_entries = []
        for op in filter(lambda o: o.core_id == core_id, self.ops):
            instr = []
            for bd_id in range(op.bd_start, op.bd_start + op.bd_count):
                if bd_id in bd_map:
                    instr.append(bd_map[bd_id])
            for g_id in range(op.gdma_start, op.gdma_start + op.gdma_count):
                if g_id in gdma_map:
                    instr.append(gdma_map[g_id])
            if not instr:
                continue
            start_cyc = min(e['start'] for e in instr)
            end_cyc   = max(e['end']   for e in instr)
            suffix = '(G)' if not op.is_local else '(L)'
            isSL = True if op.name == 'Load' or op.name == 'Store' else False
            layer_entries.append({
                'engine'   : 'LAYER',
                'op'       : op.name,
                'type'     : f"{op.name}{suffix}",
                'start'    : start_cyc,
                'end'      : end_cyc,
                'cost'     : end_cyc - start_cyc,
                'file_line' : op.file_line,
                'info'     : build_info(op),
                'isSL'      : isSL,
            })
        # 按开始时间排序
        layer_entries.sort(key=lambda x: x['start'])
        return layer_entries

# ----------------------------------------------------------
# 6. ProfileParser
# ----------------------------------------------------------
FIELDS_PROFILE = {
    'op', 'type', 'start', 'end', 'cost',
    'bd_id', 'gdma_id', 'direction', 'size', 'bandwidth'
}
class ProfileParser:
    def parse(
        self,
        raw_text: str,
        bmodel_path: Optional[Path] = None,
        core_id: int = 0,
        tiu_mhz: int = 1000,
    ) -> List[Dict[str, Any]]:
        if not raw_text:
            return []
        entries = []
        bd_entries, gdma_entries = [], []
        for line in raw_text.splitlines():
            line = line.rstrip()
            if not line or line.startswith('-') or 'ENGINE_' in line:
                continue
            left, right = self._split_two_cols(line)
            if left:
                e = self._parse_single(left, 'BD')
                if e:
                    entries.append(e)
                    bd_entries.append(e)
            if right:
                e = self._parse_single(right, 'GDMA')
                if e:
                    entries.append(e)
                    gdma_entries.append(e)
        # ---- 注入 layer ----
        if bmodel_path and bmodel_path.exists():
            layer_ext = LayerExtractor(bmodel_path)
            entries.extend(
                layer_ext.make_layer_entries(bd_entries, gdma_entries, core_id, tiu_mhz)
            )
        # -------------------
        entries.sort(key=lambda x: x['start'])
        summary = self._extract_tail_summary(raw_text)
        return [{'settings': summary, 'entries': entries}]

    # 用 ≥2 空格拆成左右两列
    def _split_two_cols(self, line: str):
        parts = re.split(r' {2,}', line, maxsplit=1)
        return parts[0], (parts[1] if len(parts) > 1 else None)

    # 把 “Conv2D_32|AR|s:117369|b:11|g:10|e:117370|t:2” 解析成 dict
    def _parse_single(self, text: str, engine: str) -> Dict[str, Any]:
        items = text.split('|')
        if len(items) < 3:
            return None
        entry = {'engine': engine}
        entry['op']   = items[0]
        entry['type'] = items[1]
        for it in items[2:]:
            m = re.match(r'(\w+):(.+)', it)
            if not m:
                continue
            k, v = m.group(1), m.group(2)
            if k == 's':
                entry['start'] = int(v)
            elif k == 'e':
                entry['end'] = int(v)
            elif k == 't':
                entry['cost'] = int(v)
            elif k == 'b':
                entry['bd_id'] = int(v)
            elif k == 'g':
                entry['gdma_id'] = int(v)
            elif k == 'dr':
                entry['direction'] = int(v)
            elif k == 'sz':
                entry['size'] = int(v)
            elif k == 'bw':
                entry['bandwidth'] = float(v)
        # 校验必填
        required = {'op', 'type', 'start', 'end', 'cost'}
        return entry if required.issubset(entry) else None
    
    def _extract_tail_summary(self, raw_text: str) -> Dict[str, Any]:
        out = {}
        # 1. API_END 行
        m = re.search(r'API_END total_cycle:(\d+)\|b:(\d+)\|g:(\d+)', raw_text)
        if m:
            out['totalCycle'] = int(m.group(1))
            out['lastBdId']   = int(m.group(2))
            out['lastGdmaId'] = int(m.group(3))
        # 2. TCYC 校验
        m = re.search(r'TCYC\s*:\s*(\d+)', raw_text)
        if m:
            out['tcyc'] = int(m.group(1))
        # 3. GDMA 四个方向
        m = re.search(r'GDMA SUMMARY\s*:.+\|dr\[0\]\s*S2L:(\d+).+\|dr\[1\]\s*L2S:(\d+).+\|dr\[2\]\s*S2S:(\d+).+\|dr\[3\]\s*L2L:(\d+)', raw_text)
        if m:
            out['gdmaBytes'] = {
                'S2L': int(m.group(1)),
                'L2S': int(m.group(2)),
                'S2S': int(m.group(3)),
                'L2L': int(m.group(4))
            }
        # 4. DDR 带宽
        m = re.search(r'DDR BW USAGE\s*:\s*([\d.]+)%', raw_text)
        if m:
            out['ddrBwUsage'] = float(m.group(1))
        # 5. FLOPS / runtime / 算力
        m = re.search(r'flops:\s*([\d.e+]+),\s*runtime:\s*([\d.]+)ms,\s*ComputationAbility:\s*([\d.]+)T', raw_text)
        if m:
            out['flops'] = int(float(m.group(1)))
            out['runtime_Ms'] = float(m.group(2))
            out['computationAbility_T'] = float(m.group(3))
        return out


# ----------------------------------------------------------
# 7. 主流程
# ----------------------------------------------------------
def parse_log(raw_log: str) -> Dict[str, Any]:
    sections = extract_valid_sections(raw_log)
    lmem_sections = sections['lmemSections']
    timestep_sections = sections['timestepSections']
    profile_text = sections['profileText']
    chip = sections['chip']

    results = {'lmem': None, 'summary': None,
               'timestep': None, 'profile': None, 'chip': chip}
    valid = {'lmem': False, 'summary': False, 'timestep': False, 'profile': False}

    # 6.1 LMEM (保持不变)
    if lmem_sections:
        try:
            lmem_parser = LmemParser(chip=chip)
            results['lmem'] = lmem_parser.parse(lmem_sections)
            valid['lmem'] = True
            if results['lmem']:
                stats = MemoryStatistics()
                stats.set_lmem_data(results['lmem'],
                                    lmem_parser.get_global_max_timestep())
                results['summary'] = stats.calculate_all_statistics()
                valid['summary'] = True
        except Exception as e:
            print(f'[LMEM] 解析错误: {e}')

    # 6.2 Timestep (保持不变)
    if timestep_sections:
        try:
            ts_parser = TimestepParser()
            results['timestep'] = ts_parser.parse(timestep_sections)
            valid['timestep'] = True
        except Exception as e:
            print(f'[Timestep] 解析错误: {e}')

    # profile 部分仅改一行
    if profile_text:
        try:
            profile_parser = ProfileParser()
            results['profile'] = profile_parser.parse(profile_text)  # 单文件场景先空着
            valid['profile'] = True
        except Exception as e:
            print(f'[Profile] 解析错误: {e}')
    ...
    return {**results, 'valid': valid, 'success': True}

# ----------------------------------------------------------
# 8. CLI（仅把 bmodel.json 路径和 core_id 传进 parse）
# ----------------------------------------------------------
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('folder', type=Path, help='包含所有日志/json 的文件夹')
    ap.add_argument('-o', '--output', required=True, type=Path,
                    help='输出文件夹（将写入 result.json 及 core_*.csv/xlsx）')
    args = ap.parse_args()

    in_dir: Path  = args.folder
    out_dir: Path = args.output
    if not in_dir.is_dir():
        print(f'❌ 输入路径不是文件夹: {in_dir}')
        exit(1)
    out_dir.mkdir(parents=True, exist_ok=True)

    # 1. 自动找主日志
    main_log = None
    for log_file in in_dir.glob('*.log'):
        txt = log_file.read_text(encoding='utf-8', errors='ignore')
        if '; action = lmem_assign' in txt or '; action = timestep_cycle' in txt:
            main_log = txt
            print(f'[info] 主日志: {log_file.name}')
            break

    # 2. 自动找 bmodel.json
    bmodel_json = next(in_dir.glob('*.bmodel.json'), None)
    if bmodel_json:
        print(f'[info] bmodel.json: {bmodel_json.name}')

    # 3. 自动找所有 compiler_profile_<n>
    prof_map, max_n = {}, -1
    prof_parser = ProfileParser()
    for prof_path in sorted(in_dir.glob('compiler_profile_*')):
        m = re.search(r'compiler_profile_(\d+)', prof_path.name)
        if not m:
            continue
        n = int(m.group(1))
        print(f'[info] 加载 profile: {prof_path.name} (core {n})')
        try:
            parsed = prof_parser.parse(
                prof_path.read_text(encoding='utf-8'),
                bmodel_path=bmodel_json,
                core_id=n
            )
            prof_map[n] = parsed[0] if parsed else {"settings": {}, "entries": []}
            max_n = max(max_n, n)
        except Exception as e:
            print(f'❌[Profile] 解析失败 {prof_path.name}: {e}')
            prof_map[n] = {"settings": {}, "entries": []}

    # 4. 解析主日志或搭空骨架
    if main_log:
        result = parse_log(main_log)
    else:
        result = {
            'lmem': None, 'timestep': None, 'summary': None,
            'profile': [], 'chip': None,
            'valid': {'lmem': False, 'summary': False, 'timestep': False, 'profile': False},
            'success': True
        }

    # 5. 组装 profile 数组
    profile_arr = []
    for i in range(max_n + 1):
        profile_arr.append(prof_map.get(i, {"settings": {}, "entries": []}))
    result['profile'] = profile_arr
    result['valid']['profile'] = any(p['entries'] for p in profile_arr)

    # 6. 写 result.json
    result_json = out_dir / 'result.json'
    result_json.write_text(json.dumps(result, ensure_ascii=False, indent=2))
    print(f'✅ json 已生成 -> {result_json}')

    # 7. 自动导出 csv & excel（不依赖额外参数）
    try:
        import openpyxl
        HAS_EXCEL = True
    except ImportError:
        HAS_EXCEL = False

    for core_id, prof in enumerate(result['profile']):
        entries = prof['entries']
        if not entries:
            continue
        keys = ['core_id', 'entry_id'] + list({k for e in entries for k in e})

        # ---- CSV ----
        csv_path = out_dir / f'core_{core_id}.csv'
        with csv_path.open('w', newline='', encoding='utf-8') as f:
            import csv
            writer = csv.DictWriter(f, fieldnames=keys)
            writer.writeheader()
            for idx, entry in enumerate(entries):
                writer.writerow({'core_id': core_id, 'entry_id': idx, **entry})
        print(f'[csv] 已导出 -> {csv_path}')

        # ---- Excel ----
        if HAS_EXCEL:
            xlsx_path = out_dir / f'core_{core_id}.xlsx'
            wb = openpyxl.Workbook()
            ws = wb.active
            ws.append(keys)
            for idx, entry in enumerate(entries):
                ws.append([{'core_id': core_id, 'entry_id': idx, **entry}.get(k) for k in keys])
            wb.save(xlsx_path)
            print(f'[excel] 已导出 -> {xlsx_path}')

# def main():
#     ap = argparse.ArgumentParser()
#     ap.add_argument('folder', type=Path, help='包含所有日志/json 的文件夹')
#     ap.add_argument('-o', '--output', required=True)
#     args = ap.parse_args()

#     folder: Path = args.folder
#     if not folder.is_dir():
#         print(f'❌ 输入路径不是文件夹: {folder}')
#         exit(1)

#     # 1. 自动找主日志（含 lmem 或 timestep）
#     main_log = None
#     for log_file in folder.glob('*.log'):
#         txt = log_file.read_text(encoding='utf-8', errors='ignore')
#         if '; action = lmem_assign' in txt or '; action = timestep_cycle' in txt:
#             main_log = txt
#             print(f'[info] LayerGroup日志: {log_file.name}')
#             break

#     # 2. 自动找 bmodel.json
#     bmodel_json = next(folder.glob('*.bmodel.json'), None)
#     if bmodel_json:
#         print(f'[info] bmodel.json: {bmodel_json.name}')

#     # 3. 自动找所有 compiler_profile_<n>（按 core_id 排序）
#     prof_map, max_n = {}, -1
#     prof_parser = ProfileParser()
#     for prof_path in sorted(folder.glob('compiler_profile_*')):
#         m = re.search(r'compiler_profile_(\d+)', prof_path.name)
#         if not m:
#             continue
#         n = int(m.group(1))
#         print(f'[info] 加载 profile: {prof_path.name} (core {n})')
#         try:
#             parsed = prof_parser.parse(
#                 prof_path.read_text(encoding='utf-8'),
#                 bmodel_path=bmodel_json,
#                 core_id=n
#             )
#             prof_map[n] = parsed[0] if parsed else {"settings": {}, "entries": []}
#             max_n = max(max_n, n)
#         except Exception as e:
#             print(f'❌[Profile] 解析失败 {prof_path.name}: {e}')
#             prof_map[n] = {"settings": {}, "entries": []}

#     # 4. 解析主日志或搭空骨架
#     if main_log:
#         result = parse_log(main_log)
#     else:
#         result = {
#             'lmem': None, 'timestep': None, 'summary': None,
#             'profile': [], 'chip': None,
#             'valid': {'lmem': False, 'summary': False, 'timestep': False, 'profile': False},
#             'success': True
#         }

#     # 5. 组装 profile 数组
#     profile_arr = []
#     profile_ok = False
#     for i in range(max_n + 1):
#         item = prof_map.get(i, {"settings": {}, "entries": []})
#         profile_arr.append(item)
#         if item["entries"]:
#             profile_ok = True
#     result['profile'] = profile_arr
#     result['valid']['profile'] = profile_ok

#     # 6. 写文件
#     try:
#         Path(args.output).write_text(json.dumps(result, ensure_ascii=False, indent=2))
#         print(f'✅ 解析完成 -> {args.output}')
#     except Exception as e:
#         print(f'❌ 写入失败: {e}')
#         exit(1)

if __name__ == '__main__':
    main()