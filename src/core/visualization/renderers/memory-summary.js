import { mat4 } from 'gl-matrix';
import { ShaderLoader } from '../shader-loader.js';
import { CoordinateUtils } from '@/utils/coordinate-utils.js';  
import { Canvas2DRenderer } from './canvas2d-renderer.js'; // 导入Canvas2DRenderer

export class SummaryRenderer {
  constructor(canvas) {
    this.canvas = canvas;

    this.gl = this.canvas.getContext('webgl2') || this.canvas.getContext('webgl');
    if (!this.gl) throw new Error('WebGL not supported');

    // 初始化2D渲染器
    this.canvas2d = new Canvas2DRenderer(this.canvas, {
      zIndex: 10,
      pointerEvents: 'none',
      className: 'letsvis-summary-overlay'
    });

    this.programs = {};
    this.buffers  = {};
    this.viewMatrix = mat4.create();
    this.currentRecords = null;
    this.vertexCount = 0;
    this.viewRange = {};
    this.padding = { left: 60, right: 20, top: 20, bottom: 0 }; // 单位：CSS 像素
    this.axisOffsetY = 0; // CSS 像素，轴整体下移量

    this.actualDataRange = {};
    this.initialized = false;
  }

  async init() {
    if (this.initialized) return;

    const dpr = window.devicePixelRatio || 1;

    await this.initShaders();
    this.initBuffers();
    
    // 初始化2D渲染器
   // this.canvas2d.init();
    this.initialized = true;

    console.log('[SummaryRenderer] 初始化完成',
                'CSS 宽高:', this.canvas.clientWidth, this.canvas.clientHeight,
                '物理宽高:', this.canvas.width, this.canvas.height,
                'dpr:', dpr);
  }

  destroy() {
    const gl = this.gl;
    Object.values(this.programs).forEach(p => gl.deleteProgram(p));
    Object.values(this.buffers).forEach(bufMap =>
        Object.values(bufMap).forEach(b => this.gl.deleteBuffer(b))
    );
    
    // 销毁2D渲染器
    this.canvas2d.destroy();
    
    this.initialized = false;
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    const w = Math.floor(this.canvas.clientWidth * dpr);
    const h = Math.floor(this.canvas.clientHeight * dpr);
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
      this.gl.viewport(0, 0, w, h);
      
      // 同步2D画布尺寸
      this.canvas2d.syncSize();
    }
    this.render();
  }

  render(records) {
    if (!records || !records.length) {
      console.warn('[SummaryRenderer] No records to render.');
      return;
    }

    try {
      this.currentRecords = records;
      //this.actualDataRange = this.calculateDataRange(records);
      console.log('实际数据范围:', this.actualDataRange);
      console.log('[SummaryRenderer] Rendering started.');

      this.resize();
      this.updateViewMatrix(records);   
      this.uploadData(records);

      const gl = this.gl;
      gl.viewport(0, 0, this.canvas.width, this.canvas.height);
      gl.clearColor(1, 1, 1, 1);
      gl.disable(gl.DEPTH_TEST);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

      this.draw();
      this.drawGrid();
      
      
      // 先完成WebGL绘制，再绘制2D坐标轴
      gl.flush();
      this.drawAxis();
      this.drawMemoryLabels(); // 添加内存标签绘制

      console.log('[SummaryRenderer] Rendering completed.');
    } catch (error) {
      console.error('[SummaryRenderer] Rendering failed:', error);
    }
  }


  async initShaders() {
    try {
      const [summaryShaders, gridShaders] = await Promise.all([
           ShaderLoader.load(this.gl, 'summary'),
           ShaderLoader.load(this.gl, 'grid')
      ]);

      this.programs = {
          summary: ShaderLoader.compile(this.gl, summaryShaders.vert, summaryShaders.frag),
          grid:    ShaderLoader.compile(this.gl, gridShaders.vert, gridShaders.frag)
      };

      if (!this.programs.summary || !this.programs.grid) {
          throw new Error('着色器编译失败');
      }
      const summaryLink = this.gl.getProgramParameter(this.programs.summary, this.gl.LINK_STATUS);
      if (!summaryLink) {
          throw new Error('Summary 着色器链接失败: ' + this.gl.getProgramInfoLog(this.programs.summary));
      }
      const gridLink = this.gl.getProgramParameter(this.programs.grid, this.gl.LINK_STATUS);
      if (!gridLink) {
          throw new Error('Grid 着色器链接失败: ' + this.gl.getProgramInfoLog(this.programs.grid));
      }
    } catch (error) {
      console.error('着色器初始化失败:', error);
      throw error;
    }
  }

  initBuffers() {
    const gl = this.gl;
    this.buffers = {
      grid: {
        position: this.createBuffer(),
        width:    this.createBuffer(),
        type:     this.createBuffer(),
      },
      summary: {
        position: this.createBuffer(),
        color:    this.createBuffer(),
      },
    };
  }

  createBuffer() {
    const buffer = this.gl.createBuffer();
    if (!buffer) throw new Error('Failed to create WebGL buffer');
    return buffer;
  }



updateViewMatrix(records) {
  if (!records || records.length === 0) {
    this.viewMatrix = mat4.create();
    return;
  }

  // 1. 计算数据范围
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  records.forEach(r => {
    minX = Math.min(minX, r.ts - 0.3);   // 左边界
    maxX = Math.max(maxX, r.ts + 0.3);   // 右边界
    minY = 0;
    maxY = Math.max(maxY, r.memory_usage);
  });

  // 2. x 方向：保持数据空间 10 % 边距
  const dx = maxX - minX || 1;
  const xMargin = dx * 0.1;
  const left   = minX - xMargin;
  const right  = maxX + xMargin;

  // 3. y 方向：固定像素留白
  const cssH = this.canvas.clientHeight;
  const p = { bottom: 40, top: 20 }; // 只留 y 方向像素边距
  const gh = cssH - p.bottom - p.top;
  const dy = maxY - minY || 1;
  const yScale = gh / dy;            // y 方向每字节对应多少像素
  const bottom = minY - p.bottom / yScale;
  const top    = maxY + p.top  / yScale;


  // 4. 生成正交矩阵
  mat4.ortho(this.viewMatrix, left, right, bottom, top, -1, 1);
  this.viewRange = { left, right, bottom, top };
}


  /* ---------- ---------- */
  uploadData(records) {
    const gl = this.gl;

    const positions = [];
    const colors    = [];
    const barWidth  = 0.6;
    //const padding   = 0;

    records.forEach(r => {
      //const xCenter = r.ts + padding;
      const xCenter = r.ts;
      const x0 = xCenter - barWidth / 2;
      const x1 = xCenter + barWidth / 2;
      const y0 = 0;
      const y1 = r.memory_usage;   // 直接使用字节值

      positions.push(x0, y0, x1, y0, x0, y1,
                     x1, y0, x1, y1, x0, y1);
      //console.log('world 实际中心坐标：', [xCenter, y0]);
      console.log('world 实际顶部坐标：', this.worldToScreenx([xCenter, y1]));
      const color = [0.6823529411764706, 0.7803921568627451, 0.9098039215686274, 1];
      for (let i = 0; i < 6; i++) colors.push(...color);
    });

    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.summary.position);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.summary.color);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.STATIC_DRAW);

    this.vertexCount = positions.length / 2;
  }

  draw() {
    const gl = this.gl;
    gl.useProgram(this.programs.summary);

    const uView = gl.getUniformLocation(this.programs.summary, 'uViewMatrix');
    gl.uniformMatrix4fv(uView, false, this.viewMatrix);

    const aPos   = gl.getAttribLocation(this.programs.summary, 'aPosition');
    const aColor = gl.getAttribLocation(this.programs.summary, 'aColor');

    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.summary.position);
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.summary.color);
    gl.enableVertexAttribArray(aColor);
    gl.vertexAttribPointer(aColor, 4, gl.FLOAT, false, 0, 0);

    gl.drawArrays(gl.TRIANGLES, 0, this.vertexCount);
  }

  /* ---------- 网格 y 值也使用真实字节 ---------- */
  generateGridData(dataRange) {
    const { minTimestep, maxTimestep, minMemory, maxMemory } = dataRange;
    const gridVertices = [];
    const lineWidths   = [];
    const lineTypes    = [];

    const yStep = this.calculateGridStep(minMemory, maxMemory);

    for (let y = 0; y < maxMemory + yStep; y += yStep) {
      gridVertices.push(minTimestep - 0.8, y, maxTimestep+0.8, y);
      lineWidths.push(0.5, 0.5);
      lineTypes.push(1.0, 1.0);
    }

    return {
      vertices:  new Float32Array(gridVertices),
      widths:    new Float32Array(lineWidths),
      types:     new Float32Array(lineTypes),
      vertexCount: gridVertices.length / 2
    };
  }

  drawGrid() {
    const records = this.currentRecords;
    if (!records || !this.programs.grid) return;

    const gl = this.gl;
    const dataRange = this.calculateDataRange(records);
    const gridData = this.generateGridData(dataRange);

    this.uploadGridBuffer(gridData);

    gl.useProgram(this.programs.grid);
    const uView = gl.getUniformLocation(this.programs.grid, 'uViewMatrix');
    gl.uniformMatrix4fv(uView, false, this.viewMatrix);

    this.setupGridShaderAttributes();
    gl.enable(gl.BLEND);
    gl.drawArrays(gl.LINES, 0, gridData.vertexCount);
    this.disableGridAttributes();
  }

  uploadGridBuffer(gridData) {
    const gl = this.gl;

    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.grid.position);
    gl.bufferData(gl.ARRAY_BUFFER, gridData.vertices, gl.STATIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.grid.width);
    gl.bufferData(gl.ARRAY_BUFFER, gridData.widths, gl.STATIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.grid.type);
    gl.bufferData(gl.ARRAY_BUFFER, gridData.types, gl.STATIC_DRAW);
  }

  setupGridShaderAttributes() {
    const gl = this.gl;
    const aPosition = gl.getAttribLocation(this.programs.grid, 'aPosition');
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.grid.position);
    gl.enableVertexAttribArray(aPosition);
    gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0);

    const aWidth = gl.getAttribLocation(this.programs.grid, 'aLineWidth');
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.grid.width);
    gl.enableVertexAttribArray(aWidth);
    gl.vertexAttribPointer(aWidth, 1, gl.FLOAT, false, 0, 0);

    const aType = gl.getAttribLocation(this.programs.grid, 'aLineType');
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.grid.type);
    gl.enableVertexAttribArray(aType);
    gl.vertexAttribPointer(aType, 1, gl.FLOAT, false, 0, 0);
  }

  disableGridAttributes() {
    const gl = this.gl;
    const aPosition = gl.getAttribLocation(this.programs.grid, 'aPosition');
    gl.disableVertexAttribArray(aPosition);
    const aWidth  = gl.getAttribLocation(this.programs.grid, 'aLineWidth');
    gl.disableVertexAttribArray(aWidth);
    const aType   = gl.getAttribLocation(this.programs.grid, 'aLineType');
    gl.disableVertexAttribArray(aType);
  }

  calculateDataRange(records) {
    if (!records || records.length === 0) {
      return { minTimestep: 0, maxTimestep: 0, minMemory: 0, maxMemory: 0 };
    }
    const minTimestep = Math.min(...records.map(r => r.ts));
    const maxTimestep = Math.max(...records.map(r => r.ts));
    const minMemory   = Math.min(...records.map(r => r.memory_usage));
    const maxMemory   = Math.max(...records.map(r => r.memory_usage));
    return { minTimestep, maxTimestep, minMemory, maxMemory };
  }

  calculateGridStep(minValue, maxValue) {
    const range = maxValue - minValue || 1;
    //return 2 * Math.pow(10, Math.floor(Math.log10(range)) - 1);
    return range / 10;
  }


  //世界坐标到屏幕坐标的转换方法
worldToScreenx([worldX, worldY]) {
  const { left, right, bottom, top } = this.viewRange;
  const xRange = right - left;
  const yRange = top - bottom;

  // 与 WebGL 侧完全一致的 10 % padding
  const paddedLeft   = left   - 0.1 * xRange;
  const paddedRight  = right  + 0.1 * xRange;
  const paddedBottom = bottom - 0.1 * yRange;
  const paddedTop    = top    + 0.1 * yRange;

  const cw = this.canvas.clientWidth;
  const ch = this.canvas.clientHeight;

  const ndcX = 2 * (worldX - paddedLeft) / (paddedRight - paddedLeft) - 1;
  const ndcY = 2 * (worldY - paddedBottom) / (paddedTop - paddedBottom) - 1;

  const screenX = (ndcX * 0.5 + 0.5) * cw;
  const screenY = (1 - (ndcY * 0.5 + 0.5)) * ch + this.axisOffsetY; // 整体下移
  return [screenX, screenY];
}


// worldToScreen([worldX, worldY]) {
//   const { left, right, bottom, top } = this.viewRange;
//   const cw = this.canvas.clientWidth;
//   const ch = this.canvas.clientHeight;

//   // 直接使用viewRange进行归一化（不再添加额外边距）
//   const normalizedX = (worldX - left) / (right - left);
//   const normalizedY = (worldY - bottom) / (top - bottom);

//   // 转换为屏幕坐标（注意Y轴翻转）
//   const screenX = normalizedX * cw;
//   const screenY = ch - normalizedY * ch; // 翻转Y轴

//   return [screenX, screenY];
// }


  //drawAxis方法，使用canvas2d
  drawAxis() {
    if (!this.currentRecords || !this.currentRecords.length) return;
    
    this.canvas2d.clear();
    
    const ctx = this.canvas2d.ctx;

    ctx.save();
    ctx.translate(0, this.axisOffsetY);
    

    const dpr = window.devicePixelRatio || 1;
    const canvasWidth = this.canvas2d.canvas.width / dpr;
    const canvasHeight = this.canvas2d.canvas.height / dpr;
    
    // 设置样式
    ctx.strokeStyle = '#333333';
    ctx.fillStyle = '#333333';
    ctx.lineWidth = 2;
    ctx.font = '12px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    const { left, right, bottom, top } = this.viewRange;
    const yStep = this.calculateGridStep(bottom, top);
    // 计算坐标轴在屏幕上的位置
    const originScreen = this.worldToScreenx([left, bottom]);
    const xEndScreen = this.worldToScreenx([right+4, bottom]);
    const yEndScreen = this.worldToScreenx([left, top+yStep]);
    
    // 绘制X轴
    ctx.beginPath();
    ctx.moveTo(originScreen[0], originScreen[1]);
    ctx.lineTo(xEndScreen[0], xEndScreen[1]);
    ctx.stroke();
    
    
    // 绘制Y轴
    ctx.beginPath();
    ctx.moveTo(originScreen[0], originScreen[1]);
    ctx.lineTo(originScreen[0], yEndScreen[1]);
    ctx.stroke();
    
    // 绘制X轴刻度和标签
    this.drawXAxisTicks(ctx, originScreen, xEndScreen, canvasHeight);
    
    // 绘制Y轴刻度和标签
    //this.drawYAxisTicks(ctx, originScreen, yEndScreen, canvasWidth);
    
    // 绘制轴标题
    //this.drawAxisLabels(ctx, canvasWidth, canvasHeight);

    ctx.restore();
  }

//   drawAxis() {
//   if (!this.currentRecords || !this.currentRecords.length) return;
  
//   this.canvas2d.clear();
//   const ctx = this.canvas2d.ctx;
//   ctx.save();
  
//   const dpr = window.devicePixelRatio || 1;
//   const canvasWidth = this.canvas2d.canvas.width / dpr;
//   const canvasHeight = this.canvas2d.canvas.height / dpr;
  
//   // 设置样式
//   ctx.strokeStyle = '#333333';
//   ctx.fillStyle = '#333333';
//   ctx.lineWidth = 2;
//   ctx.font = '12px Arial, sans-serif';
//   ctx.textAlign = 'center';
//   ctx.textBaseline = 'top';
  
//   // 计算坐标轴在屏幕上的位置
//   const originScreen = this.worldToScreen([this.viewRange.left, 0]); // X轴在y=0位置
//   const xEndScreen = this.worldToScreen([this.viewRange.right, 0]); // X轴末端
//   const yEndScreen = this.worldToScreen([this.viewRange.left, this.viewRange.top]); // Y轴顶端
  
//   // 绘制X轴
//   ctx.beginPath();
//   ctx.moveTo(originScreen[0], originScreen[1]);
//   ctx.lineTo(xEndScreen[0], xEndScreen[1]);
//   ctx.stroke();
  
//   // 绘制Y轴
//   ctx.beginPath();
//   ctx.moveTo(originScreen[0], originScreen[1]);
//   ctx.lineTo(originScreen[0], yEndScreen[1]);
//   ctx.stroke();
  
//   // 绘制X轴刻度和标签
//   this.drawXAxisTicks(ctx, originScreen, xEndScreen, canvasHeight);
  
//   // 绘制Y轴刻度和标签
//   this.drawYAxisTicks(ctx, originScreen, yEndScreen, canvasWidth);
  
//   ctx.restore();
// }




// drawXAxisTicks(ctx, originScreen, xEndScreen, canvasHeight) {
//   console.log('drawXAxisTicks called');
//   this.actualDataRange = this.calculateDataRange(this.currentRecords);
//   const minX = this.actualDataRange.minTimestep;
//   const maxX = this.actualDataRange.maxTimestep;
//   console.log('实际数据范围:', this.actualDataRange);
//   const tickLength = 8;
  
//   // 计算合适的刻度间隔
//   //const xRange = maxX - minX;
//   //const step = Math.max(1, Math.floor(xRange / 10));
  
//   // 在世界坐标系中确定刻度位置
//   const xTicks = [];
//   console.log('maxX:', maxX, 'minX:', minX);
//   for (let x = minX; x <= maxX; x += 1) {
//     xTicks.push(x);
//     console.log('world 刻度坐标:', x, this.viewRange.bottom);
//   }
  
//   // 绘制主要刻度
//   const dpr = window.devicePixelRatio || 1;
//   xTicks.forEach(x => {
//     // 将世界坐标转换为屏幕坐标
//     const tickScreenPos = this.worldToScreen([x, this.viewRange.bottom]);
//     console.log('world 刻度坐标:', x, this.viewRange.bottom);
    
//     // 绘制刻度线
//     ctx.beginPath();
//     ctx.moveTo(tickScreenPos[0]*dpr, tickScreenPos[1]);
//     ctx.lineTo(tickScreenPos[0]*dpr, tickScreenPos[1] + tickLength);
//     ctx.stroke();
    
//     // 绘制标签
//     ctx.fillText(`${Math.round(x)}`, tickScreenPos[0], tickScreenPos[1] + tickLength + 15);
//   });
// }



//   drawYAxisTicks(ctx, originScreen, yEndScreen, canvasWidth) {
//   const minY = this.actualDataRange.minMemory;
//   const maxY = this.actualDataRange.maxMemory;
//   const tickLength = 8;
  
//   // 计算合适的Y轴刻度间隔
//   const yStep = this.calculateGridStep(minY, maxY);
  
//   // 在世界坐标系中确定刻度位置
//   const yTicks = [];
//   for (let y = minY; y <= maxY; y += yStep) {
//     yTicks.push(y);
//   }
  
//   // 绘制主要刻度
//   yTicks.forEach(y => {
//     // 将世界坐标转换为屏幕坐标
//     const tickScreenPos = this.worldToScreen([this.viewRange.left, y]);
    
//     // 绘制刻度线
//     ctx.beginPath();
//     ctx.moveTo(tickScreenPos[0], tickScreenPos[1]);
//     ctx.lineTo(tickScreenPos[0] - tickLength, tickScreenPos[1]);
//     ctx.stroke();
    
//     // 格式化内存值显示
//     const formattedValue = this.formatMemoryValue(y);
    
//     // 绘制标签
//     ctx.textAlign = 'right';
//     ctx.fillText(formattedValue, tickScreenPos[0] - tickLength - 5, tickScreenPos[1]);
//     ctx.textAlign = 'center';
//   });
// }


  drawAxisLabels(ctx, canvasWidth, canvasHeight) {
    const originScreen = this.worldToScreenx([this.viewRange.left, this.viewRange.bottom]);
    const xEndScreen = this.worldToScreenx([this.viewRange.right, this.viewRange.bottom]);
    
    // X轴标题
    ctx.font = '14px Arial, sans-serif';
    ctx.fillText('Timestep', (originScreen[0] + xEndScreen[0]) / 2, originScreen[1] + 40);
    
    // Y轴标题（旋转90度）
    ctx.save();
    ctx.translate(20, canvasHeight / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Memory Usage (Bytes)', 0, 0);
    ctx.restore();
  }

  formatMemoryValue(bytes) {
    const units = ['B']; // , 'KB', 'MB', 'GB'
    let value = bytes;
    let unitIndex = 0;
    
    while (value >= 1024 && unitIndex < units.length - 1) {
      value /= 1024;
      unitIndex++;
    }
    
    return `${value.toFixed(1)} ${units[unitIndex]}`;
  }

    drawXAxisTicks(ctx, originScreen, xEndScreen, canvasHeight) {
    const { left, right, bottom } = this.viewRange;
    const tickLength = 8;
    
    // 获取时间步范围
    const timesteps = this.currentRecords.map(r => r.ts);
    const minTimestep = Math.min(...timesteps);
    const maxTimestep = Math.max(...timesteps);
    
    // 绘制主要刻度（每个时间步）
    for (let ts = minTimestep; ts <= maxTimestep; ts++) {
      const tickScreenPos = this.worldToScreenx([ts*1.2, bottom]);
      
      // 绘制刻度线
      ctx.beginPath();
      ctx.moveTo(tickScreenPos[0]-81, tickScreenPos[1]);
      ctx.lineTo(tickScreenPos[0]-81, tickScreenPos[1] + tickLength);
      ctx.stroke();
      
      // 绘制标签
      ctx.fillText(`${ts}`, tickScreenPos[0]-81, tickScreenPos[1] + tickLength + 15);
    }
  }

  drawYAxisTicks(ctx, originScreen, yEndScreen, canvasWidth) {
    const { bottom, top } = this.viewRange;
    const tickLength = 8;
    
    // 计算合适的Y轴刻度间隔
    const maxMemory = Math.max(...this.currentRecords.map(r => r.memory_usage));
    const yStep = this.calculateGridStep(bottom, top);
    
    // 绘制主要刻度
    for (let y = 0; y <= top+yStep; y += yStep) {
      const tickScreenPos = this.worldToScreen([this.viewRange.left, y]);
      
      // 绘制刻度线
      ctx.beginPath();
      ctx.moveTo(tickScreenPos[0], tickScreenPos[1]);
      ctx.lineTo(tickScreenPos[0] - tickLength, tickScreenPos[1]);
      ctx.stroke();
      
      // 格式化内存值显示
      const formattedValue = this.formatMemoryValue(y);
      
      // 绘制标签
      ctx.textAlign = 'right';
      ctx.fillText(formattedValue, tickScreenPos[0] - tickLength - 5, tickScreenPos[1]);
      ctx.textAlign = 'center';
    }
  }

  //   // 添加绘制内存标签的方法
  // drawMemoryLabels() {
  //   if (!this.currentRecords || !this.currentRecords.length) return;
    
  //   const ctx = this.canvas2d.ctx;
  //   ctx.save();
    
  //   // 设置标签样式
  //   ctx.fillStyle = '#333333';
  //   ctx.font = '12px Arial, sans-serif';
  //   ctx.textAlign = 'center';
  //   ctx.textBaseline = 'bottom';
    
  //   this.currentRecords.forEach(record => {
  //     // 计算条形图顶部的世界坐标
  //     const topCenterWorld = [record.ts, record.memory_usage];
  //     console.log('world 顶部坐标：', topCenterWorld);
      
  //     // 转换为屏幕坐标
  //     const [screenX, screenY] = this.worldToScreen(topCenterWorld);
  //     console.log('屏幕坐标：', screenX, screenY);
      
  //     // 在矩形上方绘制标签（向上偏移10像素）
  //     const labelY = screenY - 20;
      
      
  //     // 格式化内存值
  //     const formattedMemory = this.formatMemoryValue(record.memory_usage);
      
  //     // 绘制文本
  //     ctx.fillText(formattedMemory, screenX, labelY);
  //     console.log('绘制标签：', formattedMemory, '位置：', screenX, labelY);
  //   });
    
  //   ctx.restore();
  // }

  // 世界坐标到屏幕坐标的转换方法
worldToScreeny([worldX, worldY]) {
  const { left, right, bottom, top } = this.viewRange;
  const cw = this.canvas.clientWidth;
  const ch = this.canvas.clientHeight;

  // 直接使用视图矩阵进行转换（与WebGL渲染一致）
  const normalizedX = (worldX - left) / (right - left);
  const normalizedY = (worldY - bottom) / (top - bottom);

  // 转换为屏幕坐标（注意Y轴翻转）
  const screenX = normalizedX * cw;
  const screenY = ch - normalizedY * ch; // 翻转Y轴

  return [screenX, screenY];
}

// 更新绘制内存标签的方法
drawMemoryLabels() {
  if (!this.currentRecords || !this.currentRecords.length) return;
  
  const ctx = this.canvas2d.ctx;
  ctx.save();
  
  // 设置标签样式
  ctx.fillStyle = '#333333';
  ctx.font = '12px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  
  this.currentRecords.forEach(record => {
    // 计算条形图顶部的世界坐标
    const barWidth = 0.6; // 与uploadData中的barWidth一致
    const xCenter = record.ts;
    const yTop = record.memory_usage;
    
    // 转换为屏幕坐标
    const [screenX, screenY] = this.worldToScreeny([xCenter, yTop]);
    
    // 在矩形上方绘制标签（向上偏移10像素）
    const labelY = screenY - 6;
    
    // 格式化内存值 - 包括零值
    const formattedMemory = record.memory_usage === 0 
      ? "0 B" 
      : this.formatMemoryValue(record.memory_usage);
    
    // 绘制文本
    ctx.fillText(formattedMemory, screenX, labelY);
  });
  
  ctx.restore();
}



}


