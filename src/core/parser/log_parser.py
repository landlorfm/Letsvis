#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
单日志文件解析，输出固定格式 json 文件
"""
import re
import json
import argparse
from typing import List, Dict, Any, Tuple, Optional


# ---------- 1. 日志分段 ----------
def extract_valid_sections(raw_log: str) -> Dict[str, Any]:
    sections = re.split(r'(?=; action = \w+)', raw_log)

    # 1.1 芯片规格段（只取第一条）
    chip_section = next((
        s for s in sections
        if '; action = lmem_assign' in s and '; step = lmem_spec' in s
    ), None)

    chip = {}
    if chip_section:
        for m in re.finditer(r';\s*(\w+)\s*=\s*([^;]+)', chip_section):
            key, val = m.group(1), m.group(2).strip()
            if key in {'lmem_bytes', 'lmem_banks', 'lmem_bank_bytes'}:
                chip[key] = int(val)

    # 1.2 lmem_assign + iteration_result
    lmem_sections = [
        s for s in sections
        if '; action = lmem_assign' in s and '; tag = iteration_result' in s
    ]

    # 1.3 timestep 段
    timestep_sections = []
    start_idx = next((
        i for i, s in enumerate(sections)
        if '; action = timestep_cycle; debug_range = given;' in s
    ), -1)
    if start_idx != -1:
        seen = set()
        for s in sections[start_idx:]:
            if (
                '; action = timestep_cycle;' in s
                and '; step = timestep_cycle;' in s
                and '; tag = result;' in s
                and s not in seen
            ):
                seen.add(s)
                timestep_sections.append(s)

    return {'lmemSections': lmem_sections,
            'timestepSections': timestep_sections,
            'chip': chip or None}


# ---------- 2. LMEM 解析 ----------
FIELDS_WHITELIST_LMEM = {
    'op_name', 'op_type', 'addr', 'size', 'timestep_start', 'timestep_end',
    'lmem_type', 'hold_in_lmem', 'status', 'tag', 'bank_id'
}


class LmemParser:
    def __init__(self):
        self.max_timestep_global = 0

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
        valid_entry = self._validate_entry(entry)
        return valid_entry, settings

    def _process_allocation_groups(self, groups):
        out = []
        for g in groups:
            settings, allocs = g['settings'], g['allocations']
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
            out.append({
                'settings': settings,
                'allocations': [
                    {**a, 'bank_id': (a['addr'] >> 16) & 0xF, 'max_timestep': max_ts}
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


# ---------- 3. Timestep 解析 ----------
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


# ---------- 4. MemoryStatistics ----------
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


# ---------- 5. 主流程 ----------
def parse_log(raw_log: str) -> Dict[str, Any]:
    sections = extract_valid_sections(raw_log)
    lmem_sections = sections['lmemSections']
    timestep_sections = sections['timestepSections']
    chip = sections['chip']

    results = {'lmem': None, 'summary': None,
               'timestep': None, 'chip': chip}
    valid = {'lmem': False, 'summary': False, 'timestep': False}

    # 5.1 LMEM
    if lmem_sections:
        try:
            lmem_parser = LmemParser()
            results['lmem'] = lmem_parser.parse(lmem_sections)
            valid['lmem'] = True
            if results['lmem']:
                stats = MemoryStatistics()
                stats.set_lmem_data(results['lmem'],
                                    lmem_parser.get_global_max_timestep())
                results['summary'] = stats.calculate_all_statistics()
                valid['summary'] = True
                # 合并 chip 到第一个 settings
                if chip:
                    results['lmem'][0]['settings'].update(chip)
        except Exception as e:
            print(f'[LMEM] 解析错误: {e}')

    # 5.2 Timestep
    if timestep_sections:
        try:
            ts_parser = TimestepParser()
            results['timestep'] = ts_parser.parse(timestep_sections)
            valid['timestep'] = True
        except Exception as e:
            print(f'[Timestep] 解析错误: {e}')

    if not valid['lmem'] and not valid['timestep']:
        raise RuntimeError('No valid data sections found in the log file')

    return {**results, 'valid': valid, 'success': True}


# ---------- 6. CLI ----------
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('log_file')
    ap.add_argument('-o', '--output', default=None)
    args = ap.parse_args()
    if args.output is None:
        args.output = args.log_file.rsplit('.', 1)[0] + '_parsed.json'

    with open(args.log_file, encoding='utf-8') as f:
        raw = f.read()

    try:
        out = parse_log(raw)
        with open(args.output, 'w', encoding='utf-8') as f:
            json.dump(out, f, ensure_ascii=False, indent=2)
        print(f'✅ 解析完成 -> {args.output}')
    except Exception as e:
        print(f'❌ 解析失败: {e}')
        exit(1)


if __name__ == '__main__':
    main()