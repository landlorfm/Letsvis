#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
usage: 
  python convert2.py <profile_files_or_dir> <bmodel.json> [output.js]
  或
  python convert2.py <profile_file1> <profile_file2> ... <bmodel.json> [output.js]
"""

import sys, re, json, math, pathlib, collections

# ----------------------------------------------------------
# 1. 命令行参数解析 (修复版)
# ----------------------------------------------------------
if len(sys.argv) < 3:
    print("错误: 需要至少2个参数")
    print(__doc__)
    sys.exit(1)

# 自动识别参数类型
profile_paths = []  # 存储profile文件路径
bmodel_json = None  # bmodel.json文件
out_js = pathlib.Path('profile_data.js')  # 默认输出文件

# 从后往前识别参数
args = sys.argv[1:]
if args[-1].endswith('.js'):
    out_js = pathlib.Path(args.pop())

# 识别bmodel.json (最后一个非.js参数)
if args and args[-1].endswith('.json'):
    bmodel_json = pathlib.Path(args.pop())
else:
    print("错误: 未找到bmodel.json文件")
    print(__doc__)
    sys.exit(1)

# 剩余参数为profile文件/目录
profile_paths = [pathlib.Path(p) for p in args]

if not profile_paths:
    print("错误: 未提供任何profile文件或目录")
    print(__doc__)
    sys.exit(1)

print(f'[info] 输入参数:')
print(f'  - Profile文件: {[str(p) for p in profile_paths]}')
print(f'  - bmodel.json: {bmodel_json}')
print(f'  - 输出文件: {out_js}')

# ----------------------------------------------------------
# 2. 收集所有profile文件 (支持目录和文件混合)
# ----------------------------------------------------------
def collect_profile_files(paths):
    """收集所有profile文件，支持目录和文件混合输入"""
    all_files = []
    for p in paths:
        if p.is_dir():
            # 收集目录下所有compiler_profile_*文件
            files = sorted(p.glob('compiler_profile_*'))
            if not files:
                print(f"⚠️ 警告: 目录中无compiler_profile文件: {p}")
            all_files.extend(files)
        elif p.is_file():
            # 直接添加文件
            all_files.append(p)
        else:
            print(f"⚠️ 警告: 路径不存在: {p}")
    return all_files

profile_files = collect_profile_files(profile_paths)

if not profile_files:
    print("❌ 错误: 未找到任何有效的profile文件")
    sys.exit(1)

print(f'[info] 找到 {len(profile_files)} 个profile文件')



# ----------------------------------------------------------
# 2. 预定义全局量（与模板保持一致）
# ----------------------------------------------------------
PLATFORM      = "Platform: sg2262"
PAGE_CAP      = "PerfAI: result"
DDR_BW        = 34.132
L2_BW         = 0
DEPEND_CMDS   = []
CATEGORIES    = ['TPU_BD', 'TPU_GDMA', 'TPU_LAYER', 'TPU_GROUP_LAYER']
LMEM_PARTITION= [[i*16384,16384,f'BANK[{i}]'] for i in range(16)]
TIME_HEADER = [
    "category", "begin_usec", "end_usec", "func_type", "height",
    "layer_id", "layer_type", "subnet_id", "subnet_type", "iteration", "info"
]
FILTER_COLS = [5, 6, 7, 8, 9]

CONFIGS = {
    'Chip Arch': 'sg2262',
    'Platform': 'Simulator',
    'Core Num': '64',
    'NPU Num': '16',
    'TPU Lmem Size(B)': '4194304',
    'TPU Lmem Addr Width(bits)(NOT USED YET)': '18',
    'TPU Bank Addr Width(bits)': '14',
    'Execution Unit Number(int8)': '32',
    'Bus Max Burst': '4',
    'L2 Max Burst': '0',
    'Bus Bandwidth(GB/s)': '64',
    'DDR Frequency(GHz)': '8533',
    'DDR Max BW(GB/s/Core)': '34.132',
    'DDR BW COEF': '1',
    'L2 Max BW(GB/s)': '0',
    'Cube IC Align(8bits)': '32',
    'Cube OHOW Align(8bits)': '8',
    'Cube OHOW Align(16bits)': '8',
    'Vector OHOW Align(8bits)': '32',
    'TIU Frequency(MHz)': '1250',
    'DMA Frequency(MHz)': '1000'
}

SUMMARY_CAP   = "Summary Table"
SUMMARY_HEADER= ['CoreId','Parallelism(%)','totalTime(us)','TiuWorkingRatio',
                 'totalTiuCycle','uArchURate','totalGdmaCycle',
                 'GdmaDdrAvgBandwidth(GB/s)','GdmaL2AvgBandwidth(GB/s)',
                 'GdmaAvgDdrBurstLength','totalSdmaCycle',
                 'SdmaDdrAvgBandwidth(GB/s)','SdmaAvgDdrBurstLength']
# 这里先写死，有需要可后期统计
SUMMARY_DATA  = [
    ['0','128.83%',151877405,'81.33%',154395617,'99.17%',72153345,
     '24.47',0,'3.20',0,0,0],
    ['Overall','128.83%','151877.4us','81.33%','123516.49us',
     '99.17%','72153.35us','24.47',0,'3.20','0.00us',0,'0.00']
]

TIU_MHZ = 1000          # 1250 MHz 就写 1250，1000 MHz 就写 1000

# ----------------------------------------------------------
# 3. 解析 bmodel.json → 算子索引 (修复版)
# ----------------------------------------------------------
# OpNode = collections.namedtuple(
#     'OpNode',
#     'file_line core_id name bd_start bd_count gdma_start gdma_count '
#     'operands results is_local')

# def build_info(op):
#     """按目标格式拼 HTML 片段"""
#     def fmt_tensor(t):
#         shape = 'x'.join(str(s) for s in t['shape'])
#         dtype = t['type'].split('<')[-1].split(',')[0]   # 简单粗暴取 dtype
#         return f"tensor_id=-1 [{shape}] {dtype}"          # tensor_id 暂无，统一 -1

#     ins = '<br>==ins==<br>' + '<br>'.join(fmt_tensor(t) for t in op.operands) if op.operands else ''
#     outs = '<br>==outs==<br>' + '<br>'.join(fmt_tensor(t) for t in op.results) if op.results else ''
#     local = 'local_layer' if op.is_local else 'global_layer'
#     return f"<br>{local}{ins}{outs}<br>========<br>feature_size=0<br>weight_size=0<br>total_size=0"

class OpNode(collections.namedtuple(
    'OpNode',
    'file_line core_id name bd_start bd_count gdma_start gdma_count '
    'operands results is_local')):
    
    def get(self, attr, default=None):
        """安全获取属性值"""
        return getattr(self, attr, default)
    
    def get_tensor_info(self, tensor):
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



def build_info(op):
    """按目标格式拼 HTML 片段"""
    def fmt_tensor(t):
        shape, dtype = op.get_tensor_info(t)
        return f"tensor_id=-1 [{shape}] {dtype}"
    
    ins = '<br>==ins==<br>' + '<br>'.join(fmt_tensor(t) for t in op.operands) if op.operands else ''
    outs = '<br>==outs==<br>' + '<br>'.join(fmt_tensor(t) for t in op.results) if op.results else ''
    local = 'local_layer' if op.is_local else 'global_layer'
    return f"<br>{local}{ins}{outs}<br>========<br>feature_size=0<br>weight_size=0<br>total_size=0"



def parse_bmodel(path):
    """安全解析bmodel.json文件，处理格式错误"""
    ops = []
    
    # 1. 检查文件是否存在
    if not path.exists():
        print(f"❌ 错误: bmodel.json文件不存在: {path}")
        return ops
        
    # 2. 检查文件大小
    file_size = path.stat().st_size
    if file_size == 0:
        print(f"❌ 错误: bmodel.json文件为空")
        return ops
    
    # 3. 读取并修复JSON内容
    try:
        content = path.read_text(encoding='utf-8-sig').strip()  # 处理BOM头
        
        # 修复常见JSON格式错误
        if content.startswith('[') and content.endswith(',]'):
            content = content[:-2] + ']'  # 修复尾随逗号
        elif not content.startswith('[') or not content.endswith(']'):
            print(f"⚠️ 警告: JSON格式异常，尝试修复")
            content = '[' + content + ']'
            
        data = json.loads(content)
    except json.JSONDecodeError as e:
        print(f"❌ JSON解析失败: {e}")
        print(f"错误位置: {e.pos}, 行 {e.lineno}, 列 {e.colno}")
        print(f"错误上下文: {content[max(0, e.pos-50):e.pos+50]}")
        return ops
    except Exception as e:
        print(f"❌ 文件读取失败: {type(e).__name__}: {e}")
        return ops
        
    # 4. 安全解析算子
    for node in data:
        try:
            # 验证必需字段
            if not isinstance(node, dict) or not node.get('opcode', '').startswith('tpu.'):
                continue
                
            # 安全获取字段值
            fl = node.get('file-line', 'N/A')
            core = node.get('core_id', -1)
            
            # 解析算子名称
            opcode = node['opcode']
            name = opcode.split('.')[-1] if '.' in opcode else opcode
            
            # 安全处理ID列表
            before = node.get('tiu_dma_id(before)', [0, 0])
            after = node.get('tiu_dma_id(after)', [0, 0])
            
            # 确保列表长度
            if len(before) < 2: before = [0, 0]
            if len(after) < 2: after = [0, 0]
            
            bd_start = before[0]
            gdma_start = before[1]
            bd_count = after[0] - before[0]
            gdma_count = after[1] - before[1]
            
            #ops.append(OpNode(fl, core, name, bd_start, bd_count, gdma_start, gdma_count))
            ops.append(OpNode(
                fl, core, name,
                bd_start, bd_count, gdma_start, gdma_count,
                node.get('operands', []), node.get('results', []),
                node.get('is_local', False)))
            
        except Exception as e:
            print(f"⚠️ 算子解析错误: {e}")
            print(f"问题节点: {node.get('file-line', '未知')}")
            continue

    #print(f'ops: {ops}')
            
    return ops

print(f'[info] 解析 bmodel: {bmodel_json}')
bmodel_ops = parse_bmodel(bmodel_json)   # 全部算子
print(f'[info] bmodel 共 {len(bmodel_ops)} 个算子')

# ----------------------------------------------------------
# 4. 解析单个 compiler_profile_<n> 文件 (增强版)
# ----------------------------------------------------------
ProfileEntry = collections.namedtuple('ProfileEntry','type name start_id end_id start_t end_t dur dr sz bw')


import re
import re
from pathlib import Path

# 定义分割日志行的正则表达式（用于分割BD和GDMA指令）
SPLIT_RE = re.compile(r'\s{2,}')  # 匹配两个或更多连续空格

# 定义指令解析的正则表达式
INST_RE = re.compile(
    r'(?P<name>[\w_]+)\|(?P<ty>[\w_]+)\|'
    r's:(?P<s>\d+)\|b:(?P<b>\d+)\|g:(?P<g>\d+)\|'  # 基本字段
    r'(?:h:\d+\|sd:\d+\|)?'  # 使 h/sd 可选
    r'e:(?P<e>-?\d+)\|t:(?P<t>\d+)'  # 结束时间
    r'(?:\|dr:(?P<dr>\d+))?'  # 可选方向
    r'(?:\|sz:(?P<sz>\d+))?'  # 可选数据大小
    r'(?:\|bw:(?P<bw>[\d\.]+))?'  # 可选带宽
)

def parse_single_profile(path: Path):
    bd_rows, gdma_rows = [], []
    if not path.exists() or path.stat().st_size == 0:
        return bd_rows, gdma_rows, 0, 0.0

    TIU_MHZ = 1000
    max_bw = 1  # 默认最大值（避免除以0）

    # 第一遍：收集所有GDMA的bw值，计算全局最大值
    gdma_bandwidth = []
    for raw in path.read_text().splitlines():
        line = raw.rstrip()
        if not line or line.startswith('-') or 'ENGINE_' in line:
            continue
        
        # 使用SPLIT_RE分割行
        parts = SPLIT_RE.split(line, maxsplit=1)
        right = parts[1] if len(parts) > 1 else None
        
        # 检查右侧GDMA指令
        if right:
            m = INST_RE.search(right)
            if m and m.group('bw'):
                gdma_bandwidth.append(float(m.group('bw')))
    
    if gdma_bandwidth:
        max_bw = max(gdma_bandwidth)  # 获取全局最大sz值

    # 第二遍：实际解析
    for raw in path.read_text().splitlines():
        line = raw.rstrip()
        if not line or line.startswith('-') or 'ENGINE_' in line:
            continue
        
        # 使用SPLIT_RE分割行
        parts = SPLIT_RE.split(line, maxsplit=1)
        left = parts[0] if len(parts) > 0 else None
        right = parts[1] if len(parts) > 1 else None

        # 解析左侧 BD 指令
        if left:
            m = INST_RE.search(left)
            if m:
                d = m.groupdict()
                s, e = int(d['s']), int(d['e'])
                if e < 0:  # 跳过无效结束时间
                    continue
                
                begin_us = s / TIU_MHZ
                end_us = e / TIU_MHZ
                
                # BD 指令使用固定小高度 
                height = -1
                
                bd_rows.append([
                    0,  # category
                    round(begin_us, 3),
                    round(end_us, 3),
                    f"bd_id={d['b']}",
                    height,
                    -1,  # layer_id
                    f"{d['name']}(G)",  # layer_type
                    0,  # subnet_id
                    "TPU(static)",  # subnet_type
                    "Iter[0]",  # iteration
                    "BD"  # info
                ])

        # 解析右侧 GDMA 指令
        if right:
            m = INST_RE.search(right)
            if m:
                d = m.groupdict()
                s, e = int(d['s']), int(d['e'])
                if e < 0:  # 跳过无效结束时间
                    continue
                    
                begin_us = s / TIU_MHZ
                end_us = e / TIU_MHZ
                dr = int(d['dr']) if d['dr'] else -1
                sz = int(d['sz']) if d['sz'] else 0
                bw = float(d['bw']) if d['bw'] else 0.0
                
                # GDMA 指令高度基于数据大小 (sz)
                # 归一化到 0-1 范围，最大高度为1
                height = min(1.0, bw / max_bw) if max_bw > 0 else 0.5
                
                direction = 0 if dr == 0 else 1
                mem_ty = "GDMA_TENSOR" if "TENSOR" in d['ty'].upper() else "GDMA_MATRIX"
                info = (f"{mem_ty}<br>direction={direction}<br>bytes={sz}"
                        f"<br>speed={bw:.2f}GB/s")
                
                gdma_rows.append([
                    1,  # category
                    round(begin_us, 3),
                    round(end_us, 3),
                    f"gdma_id={d['g']}",
                    round(height, 4),  # 修改后的高度
                    -1,  # layer_id
                    f"{d['name']}(G)",  # layer_type
                    0,  # subnet_id
                    "TPU(static)",  # subnet_type
                    "Iter[0]",  # iteration
                    info  # info
                ])

    # 计算API结束时间和DDR带宽
    api_end = max((row[2] for row in bd_rows + gdma_rows), default=0)
    ddr_bw = 0.0  # 实际应用中可能需要计算
    
    return bd_rows, gdma_rows, api_end, ddr_bw



class CoreData:
    def __init__(self, core_id):
        self.core_id = core_id
        self.time_data = []        # 给 window.time_data<n>
        self.lmem_record = []      # 给 window.lmem_op_record<n>
        self.api_cycle = 0
        self.ddr_bw_usage = 0

cores = {}   # core_id -> CoreData

for prof_path in profile_files:
    # 从文件名提取核心ID (更健壮的匹配)
    try:
        # 支持多种文件名格式:
        #   compiler_profile_0
        #   compiler_profile_0.txt
        #   custom_profile_1.log
        match = re.search(r'(\d+)(?:\..+)?$', prof_path.stem)
        if not match:
            print(f"⚠️ 无法从文件名提取core_id: {prof_path.name}, 使用默认值0")
            core_id = 0
        else:
            core_id = int(match.group(1))
    except Exception as e:
        print(f"⚠️ 文件名解析错误: {prof_path.name}, 错误: {e}, 使用默认值0")
        core_id = 0
    
    print(f'[info] 处理 {prof_path.name} (core {core_id})')
    
    # try:
    #     bd_list, gdma_list, api_end, ddr_bw = parse_single_profile(prof_path)
    #     core = cores.setdefault(core_id, CoreData(core_id))
    #     core.api_cycle = api_end
    #     core.ddr_bw_usage = ddr_bw

    #     #print(f"bd_list:{bd_list}")

    #     # bd_map = {e[0] for e in bd_list}
    #     # gdma_map = {e[0] for e in gdma_list}

    #     # 1. 先扔指令级数据
    #     core.time_data.extend(bd_list)      # category=0/1
    #     core.time_data.extend(gdma_list)

    #     # 2. 再追加 Layer 级数据（category=2）
    #     for op in filter(lambda o: o.core_id == core_id, bmodel_ops):
    #         bd_entries = [bd_map[i] for i in range(op.bd_start, op.bd_start + op.bd_count) if i in bd_map]
    #         gdma_entries = [gdma_map[i] for i in range(op.gdma_start, op.gdma_start + op.gdma_count) if i in gdma_map]
    #         all_e = bd_entries + gdma_entries
    #         if not all_e:
    #             continue
    #         begin_us = min(e.start_t for e in all_e) / TIU_MHZ
    #         end_us   = max(e.end_t   for e in all_e) / TIU_MHZ
    #         dur_us   = end_us - begin_us
    #         func_type = f"{op.name}(L)"
    #         layer_row = [
    #             2, round(begin_us,3), round(end_us,3),
    #             func_type, 1, op.file_line, func_type,
    #             0, "TPU(static)", "Iter[0]", build_info(op)
    #         ]
    #         core.time_data.append(layer_row)

    try:
        bd_list, gdma_list, api_end, ddr_bw = parse_single_profile(prof_path)
        core = cores.setdefault(core_id, CoreData(core_id))
        core.api_cycle = api_end
        core.ddr_bw_usage = ddr_bw

        # 1. 添加指令级数据
        core.time_data.extend(bd_list)      # category=0/1
        core.time_data.extend(gdma_list)

        # 2. 创建指令ID到时间记录的字典映射
        # 注意: bd_list/gdma_list中的第3项是"bd_id=X"或"gdma_id=X"
        bd_dict = {}
        for entry in bd_list:
            # 提取 "bd_id=100" 中的 100
            bd_id = entry[3].split('=')[1]
            bd_dict[bd_id] = entry  # 存储完整记录
        
        gdma_dict = {}
        for entry in gdma_list:
            # 提取 "gdma_id=50" 中的 50
            gdma_id = entry[3].split('=')[1]
            gdma_dict[gdma_id] = entry  # 存储完整记录

        # 3. 处理当前核心的算子
        for op in filter(lambda o: o.core_id == core_id, bmodel_ops):
            all_entries = []  # 存储所有相关指令的记录
            
            # 收集BD指令
            for bd_id in range(op.bd_start, op.bd_start + op.bd_count):
                bd_str = str(bd_id)
                if bd_str in bd_dict:
                    all_entries.append(bd_dict[bd_str])
            
            # 收集GDMA指令
            for gdma_id in range(op.gdma_start, op.gdma_start + op.gdma_count):
                gdma_str = str(gdma_id)
                if gdma_str in gdma_dict:
                    all_entries.append(gdma_dict[gdma_str])
            
            # 如果没有找到任何指令记录，跳过该算子
            if not all_entries:
                continue
            
            # 计算时间范围 (所有指令的最小开始和最大结束时间)
            # 注意: 时间在parse_single_profile中已转换为微秒
            begin_us = min(entry[1] for entry in all_entries)
            end_us = max(entry[2] for entry in all_entries)
            
            # 构建Layer记录
            func_type = f"{op.name}(L)"
            layer_row = [
                2,  # category=2 (TPU_LAYER)
                round(begin_us, 3), 
                round(end_us, 3),
                func_type, 
                1,  # 固定高度
                op.file_line,  # layer_id
                func_type,     # layer_type
                0,  # subnet_id
                "TPU(static)",  # subnet_type
                "Iter[0]",      # iteration
                build_info(op)  # HTML信息
            ]
            core.time_data.append(layer_row)

        # 4. 按时间排序
        core.time_data.sort(key=lambda r: r[1])

        # 3. 按时间排序（可选，前端也能排）
        # core.time_data.sort(key=lambda r: r[1])
    except Exception as e:
        print(f"❌ 处理 {prof_path.name} 失败: {type(e).__name__}: {e}")
        continue

print(f'[info] 共处理 {len(cores)} 个 core')

# print(f'core{core.time_data}')

# ----------------------------------------------------------
# 6. 写出 profile_data.js (增强兼容性)
# ----------------------------------------------------------
try:
    with out_js.open('w', encoding='utf-8') as f:
        f.write('var np = {float64: v=>parseFloat(v), int64: v=>parseInt(v,10)};\n')
        f.write(f'let page_caption = {json.dumps(PAGE_CAP)};\n')
        f.write(f'let platform = {json.dumps(PLATFORM)};\n')
        f.write(f'let configs = {json.dumps(CONFIGS)};\n')
        f.write(f'let summary_caption = {json.dumps(SUMMARY_CAP)};\n')
        f.write(f'let summary_header = {json.dumps(SUMMARY_HEADER)};\n')
        f.write(f'let summary_data = {json.dumps(SUMMARY_DATA)};\n')
        f.write(f'let ddr_bandwidth = {DDR_BW};\n')
        f.write(f'let l2_bandwidth = {L2_BW};\n')
        f.write(f'let dependCmds = {json.dumps(DEPEND_CMDS)};\n')
        f.write(f'let categories = {json.dumps(CATEGORIES)};\n')
        f.write(f'let filter_cols = {json.dumps(FILTER_COLS)};\n')
        f.write(f'let lmem_partition = {json.dumps(LMEM_PARTITION)};\n')
        f.write(f'let time_header = {json.dumps(TIME_HEADER)};\n')

        for core_id, core in cores.items():
            f.write(f'window.time_data{core_id} = {json.dumps(core.time_data)};\n')
            f.write(f'window.lmem_op_record{core_id} = {json.dumps(core.lmem_record)};\n')
            # lane 暂无
            f.write(f'window.lane_op_record{core_id} = [];\n')

    print('[info] 已生成', out_js)
    
except Exception as e:
    print(f"❌ 写入输出文件失败: {type(e).__name__}: {e}")
    sys.exit(1)
