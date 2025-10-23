/**
 * 颜色映射函数
 * @returns {function(Object):string} 根据 block 信息返回颜色字符串的函数
 */
function createColorMap() {
  const TAB20_COLORS = [
    [0.121, 0.466, 0.705, 0.7],[0.682, 0.780, 0.909, 0.7],[1.000, 0.498, 0.055, 0.7],[1.000, 0.733, 0.471, 0.7],[0.173, 0.627, 0.173, 0.7],[0.596, 0.874, 0.541, 0.7],[0.839, 0.153, 0.157, 0.7],[1.000, 0.596, 0.588, 0.7],[0.580, 0.404, 0.741, 0.7],[0.773, 0.690, 0.835, 0.7],[0.549, 0.337, 0.294, 0.7],[0.769, 0.612, 0.580, 0.7],[0.890, 0.467, 0.761, 0.7],[0.969, 0.714, 0.824, 0.7],[0.498, 0.498, 0.498, 0.7],[0.780, 0.780, 0.780, 0.7],[0.737, 0.741, 0.133, 0.7],[0.859, 0.859, 0.553, 0.7],[0.090, 0.745, 0.812, 0.7],[0.619, 0.855, 0.898, 0.7]
  ];
  const colorMap = {};
  let nextIndex = 0;
  return function (block) {
    let base = 0;
    if (block.lmem_type === 'LMEM_WEIGHT') base = 20;
    if (block.lmem_type === 'LMEM_OPERATION') base = 40;
    if (!colorMap[block.op_name]) colorMap[block.op_name] = nextIndex++ % 20;
    const idx = (base + colorMap[block.op_name]) % TAB20_COLORS.length;
    let c = [...TAB20_COLORS[idx]];
    if (block.status === 'failed') {
      c = [Math.min(1, c[0] * 0.8 + 0.5), c[1] * 0.4, c[2] * 0.4, c[3]];
    }
    return `rgba(${Math.floor(c[0]*255)},${Math.floor(c[1]*255)},${Math.floor(c[2]*255)},${c[3]})`;
  };
}


// 2. 主入口函数
/**
 * 生成 LMEM 相关的可视化选项options
 * @param {Array<Object>} allocations 当前配置对应的算子矩形数据
 * @param {Object} settings 当前配置全局设置
 * @param {*} viewRange 
 * @returns {Object} 可视化选项对象
 */
export function generateLmemOption(allocations, settings, viewRange = null) {
  const getColor = createColorMap();
  const list = Array.isArray(allocations) ? allocations : (allocations?.allocations || []);
  const lmemBankBytes = settings?.lmem_bank_bytes ?? 0;
  let bankNum = settings?.lmem_banks ?? 0;

  // 计算总时间步 & 总内存
  let maxTs = 0, maxMem = settings?.lmem_bytes ?? 0;
  list.forEach(a => {
    if (a.hold_in_lmem) maxTs = Math.max(maxTs, a.timestep_end ?? 0);
    else maxTs = Math.max(maxTs, a.timestep_start, a.timestep_end);
    maxMem = Math.max(maxMem, a.addr + (a.size || 0));
  });
  maxTs = Math.max(1, maxTs) + 1;
  maxMem = Math.max(1, maxMem);

  const range = viewRange || { left: -0.5, right: maxTs - 0.5, bottom: 0, top: maxMem };

  // 3. 构造 scatter 数据：每个块 → 一个矩形(custom)
  const scatterData = [];

  // 构造坐标轴元素数据(custom)
  const axisElements = [];
  const labelElements = [];
  const tickElements = [];
  
  list.forEach(alloc => {
    if (!alloc.size || alloc.size <= 0) return;
    const color = getColor(alloc);

    if (alloc.hold_in_lmem) {
      // 常驻块
      const x = (range.left + range.right) / 2;
      const y = alloc.addr + alloc.size / 2;
      const w = range.right - range.left;
      const h = alloc.size;
      
      scatterData.push({
        value: [x,y],
        symbol: 'rect',
        symbolSize: [w, h],
        itemStyle: { color },
        alloc
      });
    } else if (alloc.timestep_start > alloc.timestep_end) {
      // 回环块：拆两段
      const h = alloc.size;
      const w1 = maxTs - alloc.timestep_start;
      const w2 = alloc.timestep_end + 1;

      if (w1 > 0) {
        scatterData.push({
          value: [(alloc.timestep_start + maxTs) / 2 - 0.5, alloc.addr + h / 2],
          symbol: 'rect',
          symbolSize: [w1, h],
          itemStyle: { color },
          alloc
        });
      }
      if (w2 > 0) {
        scatterData.push({
          value: [alloc.timestep_end / 2, alloc.addr + h / 2],
          symbol: 'rect',
          symbolSize: [w2, h],
          itemStyle: { color },
          alloc
        });
      }
    } else {
      // 正常时间范围
      const x = (alloc.timestep_start + alloc.timestep_end) / 2;
      const y = alloc.addr + alloc.size / 2;
      const w = alloc.timestep_end - alloc.timestep_start + 1;
      const h = alloc.size;

      scatterData.push({
        value: [x, y],
        symbol: 'rect',
        symbolSize: [w, h],
        itemStyle: { color },
        alloc
      });
    }
    //console.log('scatterData', {scatterData});
  });

  console.log('矩形数据:', scatterData.length, '个矩形');

    // X轴（时间轴）元素
  const xAxisY = 0; // X轴位置（底部）
  axisElements.push({
    type: 'line',
    coords: [[range.left, xAxisY], [range.right, xAxisY]],
    lineStyle: { stroke: 'rgba(0,0,0,1)', width: 2 }
  });

  // Y轴（内存地址轴）元素
  const yAxisX = range.left; // Y轴位置（左侧）
  axisElements.push({
    type: 'line',
    coords: [[yAxisX, range.bottom], [yAxisX, range.top]],
    lineStyle: { stroke: '#333', width: 2 }
  });

  // 右侧Bank轴元素
  const yAxisRightX = range.right; // 右侧轴位置
  axisElements.push({
    type: 'line',
    coords: [[yAxisRightX, range.bottom], [yAxisRightX, range.top]],
    lineStyle: { stroke: '#666', width: 1 }
  });

  // X轴刻度和标签
  for (let t = 0; t < maxTs; t++) {
    if (Number.isInteger(t)) {
      const x = t;
      // 刻度线
      tickElements.push({
        type: 'line',
        coords: [[x, xAxisY], [x, xAxisY - 0.02 * (range.top - range.bottom)]],
        lineStyle: { stroke: '#333', width: 1 }
      });
      
      // 标签
      labelElements.push({
        type: 'text',
        x: x,
        y: xAxisY - 0.03 * (range.top - range.bottom),
        text: t.toString(),
        style: { 
          textAlign: 'center',
          textVerticalAlign: 'top',
          fill: '#333',
          fontSize: 12
        }
      });
    }
  }

  // Y轴刻度和标签
  bankNum = Math.max(bankNum, Math.ceil(maxMem / lmemBankBytes));
  for (let b = 0; b <= bankNum; b++) {
    const y = b * lmemBankBytes;
    const y_b = y + lmemBankBytes / 2;
    if (y > range.top) break;
    
    // 左侧刻度
    tickElements.push({
      type: 'line',
      coords: [[yAxisX, y], [yAxisX + 0.005 * (range.right - range.left), y]],
      lineStyle: { stroke: '#333', width: 1 }
    });

    // 右侧刻度
    tickElements.push({
      type: 'line',
      coords: [[range.right, y_b], [range.right - 0.0025 * (range.right - range.left), y_b]],
      lineStyle: { stroke: '#333', width: 1 }
    });
    
    // 左侧标签
    labelElements.push({
      type: 'text',
      x: yAxisX - 0.01 * (range.right - range.left),
      y: y,
      text: y >= 1048576 ? (y / 1048576).toFixed(1) + ' MB' 
            : y >= 1024 ? (y / 1024).toFixed(0) + ' KB' 
            : y + ' B',
      //text: y,
      style: { 
        textAlign: 'right',
        textVerticalAlign: 'middle',
        fill: '#333',
        fontSize: 12
      }
    });
    
    // 右侧bank标签（放在bank中间）
    if (b < bankNum) {
      const midY = y + lmemBankBytes / 2;
      labelElements.push({
        type: 'text',
        x: yAxisRightX + 0.01 * (range.right - range.left),
        y: midY,
        text: `bank${b}`,
        style: { 
          textAlign: 'left',
          textVerticalAlign: 'middle',
          fill: '#666',
          fontSize: 12
        }
      });
    }
  }

  // 轴标题
  labelElements.push(
    // X轴标题
    {
      type: 'text',
      x: (range.left + range.right) / 2,
      y: xAxisY - 0.08 * (range.top - range.bottom),
      text: 'Time Step',
      style: {
        textAlign: 'center',
        textVerticalAlign: 'top',
        fill: '#333',
        fontSize: 14,
        fontWeight: 'bold'
      }
    },
    // Y轴标题
    {
      type: 'text',
      x: yAxisX - 0.01 * (range.right - range.left),
      y: range.top + 0.03 * (range.top - range.bottom),//(range.bottom + range.top) / 2,
      text: 'Memory Address',
      style: {
        textAlign: 'center',
        textVerticalAlign: 'bottom',
        fill: '#333',
        fontSize: 12,
        fontWeight: 'bold',
        textRotation: -Math.PI / 2  // 逆时针 90°（弧度）
      }
    }
  );

  // 4. 网格线（line）
  const gridLines = [];
  for (let ts = 0; ts <= maxTs; ts++)
    gridLines.push({ coords: [[ts - 0.5, 0], [ts - 0.5, maxMem]], 
                    lineStyle: { color: 'rgba(0, 0, 0, 0.5)', width: 0.5 } 
                });
   bankNum = Math.max(bankNum, Math.ceil(maxMem / lmemBankBytes) );
  for (let b = 0; b < bankNum; b++) {
    const y = b * lmemBankBytes;
    gridLines.push({ coords: [[range.left, y], [range.right, y]], 
                    lineStyle: { color: 'rgba(0, 0, 0, 0.5)', width: 0.5 } 
                });
  }
  if (settings?.lmem_bytes){
    gridLines.push({
        coords: [[range.left, settings.lmem_bytes], [range.right, settings.lmem_bytes]],
        lineStyle: {
            color: 'rgba(160,0,0,1.0)',   // 暗红 + 无透明度
            width: 2,
            type: 'dashed'                 // 虚线
        }
    });
  }

    const leftTicks = [];                 // 左侧轴刻度位置
    for (let b = 0; b < bankNum; b++) {
    leftTicks.push(b * lmemBankBytes);  // 只放边界
    }

  // 5. 返回 option
  return {
    backgroundColor: 'rgba(250,250,250,1)',
    grid: { left: 30, right: 80, top: 30, bottom: 40, containLabel: true },

    xAxis: {
    type: 'value',
    min: range.left,
    max: range.right,
    show: false
    },
    yAxis: {
    type: 'value',
    min: range.bottom,
    max: range.top,
    show: false
    },

    dataZoom: [
        { // X 方向平移+缩放
            type: 'inside',
            xAxisIndex: 0,
            yAxisIndex: null,      // 只让 X 轴响应
            filterMode: 'none',
            zoomOnMouseWheel: true,
            moveOnMouseMove: true, // 左键拖 X
            zoomLock: false,
            transformOrigin: 'mouse'
        },
        { // Y 方向平移+缩放
            type: 'inside',
            xAxisIndex: null,      // 只让 Y 轴响应
            yAxisIndex: 0,
            filterMode: 'none',
            zoomOnMouseWheel: true,
            moveOnMouseMove: true, // 左键拖 Y
            zoomLock: false,
            transformOrigin: 'mouse'
        }
        ],dataZoom: [
        // X 方向平移+缩放
        {
            type: 'inside',
            xAxisIndex: 0,
            yAxisIndex: null,      // 只让 X 轴响应
            filterMode: 'none',
            zoomOnMouseWheel: true,
            moveOnMouseMove: true, // 左键拖 X
            zoomLock: false,
            transformOrigin: 'mouse'
        },
        // Y 方向平移+缩放
        {
            type: 'inside',
            xAxisIndex: null,      // 只让 Y 轴响应
            yAxisIndex: 0,
            filterMode: 'none',
            zoomOnMouseWheel: true,
            moveOnMouseMove: true, // 左键拖 Y
            zoomLock: false,
            transformOrigin: 'mouse'
        }
    ],
    tooltip: {
      trigger: 'item',
      formatter: p => {
        //const a = p.data.alloc;
        const a = p.data?.alloc;   // 防御式读取
        if (!a) return '';         // 拿不到就空串，不抛错
        const szKB = a.size / 1024;
        return `
          <div style="font-weight:bold;margin-bottom:5px">${a.op_name}</div>
          <div>Timestep: ${a.timestep_start} → ${a.timestep_end}</div>
          <div>Address: 0x${a.addr.toString(16)} - 0x${(a.addr + a.size).toString(16)}</div>
          <div>Size: ${a.size} B (${szKB.toFixed(1)} KB)</div>
          <div><span>Op Type:</span> ${a.op_type || 'N/A'}</div>
          <div><span>LMEM Type:</span> ${a.lmem_type}</div>
          <div><span>Hold_in_Lmem:</span> ${a.hold_in_lmem}</div>
          <div>Status: <span style="color:${a.status === 'success' ? 'green' : 'red'}">${a.status}</span></div>`;
      }
    },
    series: [
        { 
            type: 'lines', 
            name: 'Grid', 
            coordinateSystem: 'cartesian2d', 
            polyline: false, 
            clip:false,
            lineStyle: { width: 0.5 }, 
            data: gridLines, 
            z: 1 
        },

    // 坐标轴元素系列（custom）
      {
        type: 'custom',
        name: 'Axis System',
        clip: false,
        renderItem: function (params, api) {
          const group = [];
          const coordSys = api.coordSys;
        //   console.log('coordSys', {coordSys});
          
          // 绘制坐标轴
          axisElements.forEach(elem => {
            const p1 = api.coord(elem.coords[0]);
            const p2 = api.coord(elem.coords[1]);
            //console.log('axisElement', {p1, p2})
            if (p1 && p2) {
              group.push({
                type: 'line',
                //shape: { x1: p1[0], y1: p1[1], x2: p2[0], y2: p2[1] },
                shape: {
                    x1: Math.round(p1[0]),
                    y1: Math.round(p1[1]),
                    x2: Math.round(p2[0]),
                    y2: Math.round(p2[1])
                },
                style: elem.lineStyle,
              });
            }
          });
          
          // 绘制刻度
          tickElements.forEach(elem => {
            const p1 = api.coord(elem.coords[0]);
            const p2 = api.coord(elem.coords[1]);
            if (p1 && p2) {
              group.push({
                type: 'line',
                shape: { x1: p1[0], y1: p1[1], x2: p2[0], y2: p2[1] },
                style: elem.lineStyle
              });
            }
          });
          
          // 绘制标签
          labelElements.forEach(elem => {
            const point = api.coord([elem.x, elem.y]);
            if (point) {
              group.push({
                type: 'text',
                x: point[0],
                y: point[1],
                style: {
                  text: elem.text,
                  ...elem.style
                }
              });
            }
          });
          
          return { type: 'group', children: group };
        },
        data: [0], // 单一数据项驱动
        z: 10
      },
      {   // 矩形块序列（custom）
        type: 'custom',
        name: 'Memory Blocks',
        data: scatterData,
        clip: false,
        renderItem(params, api) {
            const dat = scatterData[params.dataIndex];
            const alloc = dat.alloc;
            const isFailed = alloc.status === 'failed';

            /* ---------- 1. 像素坐标 ---------- */
            const x0 = api.coord([dat.value[0] - dat.symbolSize[0]/2, dat.value[1]])[0];
            const x1 = api.coord([dat.value[0] + dat.symbolSize[0]/2, dat.value[1]])[0];
            const y0 = api.coord([dat.value[0], dat.value[1] - dat.symbolSize[1]/2])[1];
            const y1 = api.coord([dat.value[0], dat.value[1] + dat.symbolSize[1]/2])[1];
            const w = x1 - x0, h = y1 - y0;

            /* ---------- 2. 底色矩形 ---------- */
            const items = [{
            type: 'rect',
            shape: { x: x0, y: y0, width: w, height: h },
            style: { fill: dat.itemStyle.color },
            z2: 2,
            alloc: alloc
            }];

            // 失败块角标
            if (isFailed) {
                const cornerSize = Math.min(w, h) * 0.2;
                items.push({
                type: 'polygon',
                shape: {
                    points: [
                    [x0, y0], [x0 - cornerSize, y0], 
                    [x0, y0 + cornerSize]
                    ]
                },
                style: {
                    fill:  'rgba(61, 58, 58, 0.5)',
                    lineWidth: 1
                },
                z2: 4
                }, {
                type: 'polygon',
                shape: {
                    points: [
                    [x0 + w, y0 + h], [x0 + w + cornerSize, y0 + h], 
                    [x0 + w, y0 + h - cornerSize]
                    ]
                },
                style: {
                    fill:  'rgba(61, 58, 58, 0.5)',
                    lineWidth: 1
                },
                z2: 4
                });
  
            }

            /* ---------- 3. 图案 ---------- */
            const strokeColor = 'rgba(56, 55, 55, 1)';   // 图案颜色
            if (alloc.lmem_type === 'LMEM_WEIGHT') {
                const spacing = 8;
                const angle = -45;
                const rad = angle * Math.PI / 180;
                
                // 先创建裁剪区域
                const clipPath = {
                    type: 'rect',
                    shape: { x: x0, y: y0, width: w, height: h }
                };
                // 创建斜线组
                const lineGroup = {
                    type: 'group',
                    clipPath: clipPath,
                    children: []
                };
                // 计算斜线参数
                const diag = Math.sqrt(w * w + h * h);
                const lineCount = Math.ceil(diag / spacing) * 2;
                
                for (let i = -lineCount; i <= lineCount; i++) {
                    const offset = i * spacing;
                    
                    lineGroup.children.push({
                    type: 'line',
                    silent: true,
                    shape: {
                        x1: x0 - diag + offset * Math.cos(rad),
                        y1: y0 - diag + offset * Math.sin(rad),
                        x2: x0 + diag + offset * Math.cos(rad),
                        y2: y0 + diag + offset * Math.sin(rad)
                    },
                    style: { 
                        stroke: strokeColor, 
                        lineWidth: Math.max(1.5, h / 10)
                    }
                    });
                }
                
                items.push(lineGroup);

            } else if (alloc.lmem_type === 'LMEM_OPERATION') {
                const step = 7;                 // 横向、纵向步距
                const fontSize = 8;             // 星号大小
                for (let px = x0 + step/2; px < x1; px += step) {
                    for (let py = y1 + step/2; py < y0; py += step) {
                    // console.log('item pushed');
                    items.push({
                        type: 'text',
                        silent:true,
                        style: {
                        text: '✦',
                        x: px,
                        y: py,
                        font: `${fontSize}px sans-serif`,
                        fill: strokeColor,
                        textAlign: 'center',
                        textVerticalAlign: 'middle'
                        },
                        z2: 3
                    });
                    }
                }
                }
            // LMEM_ACTIVATION 什么都不加，保持纯色
            return { type: 'group', siletn: true, children: items };
            //return items;
        },
        z: 2
        }
    ]
  };
}
