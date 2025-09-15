import { mat4 } from 'gl-matrix';
import { ShaderLoader } from '../shader-loader.js';
import { Canvas2DRenderer } from './canvas2d-renderer.js';

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

    // 状态管理
    this.lastData = null;
    this.programs = {};
    this.buffers = {};
    this.viewMatrix = mat4.create();
    this.currentStepStats = null; // 改为存储 stepStatistics
    this.currentData = null;
    this.vertexCount = 0;
    this.viewRange = {};
    this.gridRange = {};
    this.initialized = false;
    
    // 配置参数
    this.config = {
      barWidth: 0.8,
      barColor: [0.682, 0.780, 0.910, 1], // 柔和的蓝色
      padding: { left: 60, right: 20, top: 20, bottom: 40 },
      axisColor: '#333333',
      gridColor: 'rgba(0, 0, 0, 0.1)',
      labelFont: '12px Arial, sans-serif'
    };
  }

  async init() {
    if (this.initialized) return;
    
    await this.initShaders();
    this.initBuffers();
    // this.resize();
    // window.addEventListener('resize', resize);

    const resizeCanvas = () => {
      const dpr = window.devicePixelRatio || 1;
      const displayWidth = Math.floor(this.canvas.clientWidth * dpr);
      const displayHeight = Math.floor(this.canvas.clientHeight * dpr);

      if (this.canvas.width !== displayWidth || this.canvas.height !== displayHeight) {
          this.canvas.width = displayWidth;
          this.canvas.height = displayHeight;
          this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);

          // 同步2d画布尺寸
          this.canvas2d.syncSize();

          if (this.lastData) {
              this.updateViewMatrix(this.lastData); // *** MODIFIED *** 调整大小时重新计算矩阵
              this.render(this.lastData); // 重绘
          }
      }
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    this.initialized = true;
    
  }

  destroy() {
    const gl = this.gl;
    
    Object.values(this.programs).forEach(p => gl.deleteProgram(p));
    Object.values(this.buffers).forEach(bufMap => {
      Object.values(bufMap).forEach(b => gl.deleteBuffer(b));
    });
    window.removeEventListener('resize', this.resizeCanvas);
    this.canvas2d.destroy();
    this.initialized = false;
  }

  // resize() {
  //   const dpr = window.devicePixelRatio || 1;
  //   const w = Math.floor(this.canvas.clientWidth * dpr);
  //   const h = Math.floor(this.canvas.clientHeight * dpr);
    
  //   if (this.canvas.width !== w || this.canvas.height !== h) {
  //     this.canvas.width = w;
  //     this.canvas.height = h;
  //     this.gl.viewport(0, 0, w, h);
  //     this.canvas2d.syncSize();
      
  //     if (this.lastData){
  //       //this.updateViewMatrix(this.lastData);
  //       this.render(this.lastData);
  //     }
  //   }
  // }

  render(summaryData) {
    if (!summaryData) {
      console.warn('[SummaryRenderer] No summary data provided');
      return;
    }

    // 支持两种数据格式：完整的summary对象或stepStatistics数组
    let stepStatistics = [];
    if (Array.isArray(summaryData)) {
      // 直接传入 stepStatistics 数组
      //stepStatistics = summaryData;
      console.warn('[SummaryRenderer] Received StepStatistics Array, need summary of this setting')
    } else if (summaryData.stepStatistics && Array.isArray(summaryData.stepStatistics)) {
      // 传入完整的 summary 对象
      stepStatistics = summaryData.stepStatistics;
    } else if (summaryData.groups && Array.isArray(summaryData.groups)) {
      // 传入 groups 数组（全局summary）
      console.warn('[SummaryRenderer] Received global summary, need specific group data');
      return;
    }

    if (stepStatistics.length === 0) {
      console.warn('[SummaryRenderer] No step statistics to render');
      return;
    }

    // this.lastData = stepStatistics;
    // this.currentStepStats = stepStatistics;
    this.lastData = summaryData;
    this.currentData = summaryData;
    
    try{ 
      // if (!this.viewRange) {
      //     this.updateViewMatrix(summaryData);   // 只有第一次或数据变化时才算
      // }
      this.updateViewMatrix(summaryData);

      // 跟随矩阵同步更新视图
      //this.updateViewRangeFromMatrix();

      this.uploadData(summaryData);
      
      const gl = this.gl;
      gl.viewport(0, 0, this.canvas.width, this.canvas.height);
      gl.clearColor(1, 1, 1, 1);
      gl.disable(gl.DEPTH_TEST);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      
      this.drawBars();
      this.drawGrid(summaryData);
      gl.flush();
      
      // 先清空2d元素
      this.canvas2d.clear();
      this.draw2DElements();
      
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
        grid: ShaderLoader.compile(this.gl, gridShaders.vert, gridShaders.frag)
      };
      
    } catch (error) {
      console.error('着色器初始化失败:', error);
      throw error;
    }
  }

  initBuffers() {
    const gl = this.gl;
    this.buffers = {
      grid: { position: this.createBuffer() },
      summary: { position: this.createBuffer(), color: this.createBuffer() },
    };
  }

  createBuffer() {
    const buffer = this.gl.createBuffer();
    if (!buffer) throw new Error('Failed to create WebGL buffer');
    return buffer;
  }

  updateViewMatrix(summaryData) {
    const stepStats = summaryData.stepStatistics;
    if (!stepStats || stepStats.length === 0) return;
    
    const { barWidth, padding } = this.config;
    
    // 计算数据范围
    let minX = Infinity, maxX = -Infinity;
    let minY = 0, maxY = -Infinity;
    
    stepStats.forEach(stat => {
      const ts = stat.step;
      minX = Math.min(minX, ts - barWidth / 2);
      maxX = Math.max(maxX, ts + barWidth / 2);
      maxY = Math.max(maxY, stat.usedMemory || 0);
    });
    
    // 添加边距
    const xRange = maxX - minX || 1;
    const xMargin = xRange * 0.1;
    const left = minX - xMargin;
    const right = maxX + xMargin;
    
    // Y轴范围（考虑总内存）
    //const totalMemory = stepStats[0]?.totalMemory || maxY * 1.2;
    const totalMemory = summaryData.summary.maxMemoryUsage;
    //
    maxY = Math.max(maxY, totalMemory * 0.8); // 确保显示大部分内存范围
    //maxY = totalMemory;

    const canvasHeight = this.canvas.clientHeight;
    const gh = canvasHeight - padding.bottom - padding.top;
    const yRange = maxY - minY || 1;
    const yScale = gh / yRange;
    const bottom = minY - padding.bottom / yScale;
    const top = maxY + padding.top / yScale;
    
    mat4.ortho(this.viewMatrix, left, right, bottom, top, -1, 1);
    this.viewRange = { left, right, bottom, top };
    
  }


  uploadData(summaryData) {
    const stepStats = summaryData.stepStatistics;
    const gl = this.gl;
    const { barWidth, barColor } = this.config;
    
    const positions = [];
    const colors = [];
    
    stepStats.forEach(stat => {
      const xCenter = stat.step;
      const x0 = xCenter - barWidth / 2;
      const x1 = xCenter + barWidth / 2;
      const y0 = 0;
      const y1 = stat.usedMemory || 0;
      
      positions.push(
        x0, y0, x1, y0, x0, y1,
        x1, y0, x1, y1, x0, y1
      );
      if(stat.step < 3){
        console.log('[对齐] 矩形中心坐标：', xCenter, y0)
      }
      
      for (let i = 0; i < 6; i++) {
        colors.push(...barColor);
      }
    });
    
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.summary.position);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);
    
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.summary.color);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.STATIC_DRAW);
    
    this.vertexCount = positions.length / 2;
  }

  drawBars() {
    const gl = this.gl;
    const program = this.programs.summary;
    
    if (!program) return;
    
    gl.useProgram(program);
    
    const uView = gl.getUniformLocation(program, 'uViewMatrix');
    gl.uniformMatrix4fv(uView, false, this.viewMatrix);
    
    const aPos = gl.getAttribLocation(program, 'aPosition');
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.summary.position);
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
    
    const aColor = gl.getAttribLocation(program, 'aColor');
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.summary.color);
    gl.enableVertexAttribArray(aColor);
    gl.vertexAttribPointer(aColor, 4, gl.FLOAT, false, 0, 0);
    
    gl.drawArrays(gl.TRIANGLES, 0, this.vertexCount);
  }

  drawGrid(summaryData) {
    if (!this.currentData || !this.programs.grid) return;
    //
    const gl = this.gl;
    const gridData = this.generateGridData(summaryData);
    
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.grid.position);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(gridData.vertices), gl.STATIC_DRAW);
    
    gl.useProgram(this.programs.grid);
    
    const uView = gl.getUniformLocation(this.programs.grid, 'uViewMatrix');
    gl.uniformMatrix4fv(uView, false, this.viewMatrix);
    
    const uColor = gl.getUniformLocation(this.programs.grid, 'uColor');
    gl.uniform4fv(uColor, [0, 0, 0, 0.1]);
    
    const aPosition = gl.getAttribLocation(this.programs.grid, 'aPosition');
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.grid.position);
    gl.enableVertexAttribArray(aPosition);
    gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0);
    
    gl.drawArrays(gl.LINES, 0, gridData.vertexCount);
    gl.disableVertexAttribArray(aPosition);
  }

  generateGridData(summaryData) {
    if (!this.currentData) return { vertices: [], vertexCount: 0 };
    //

    //const { left, right, bottom, top } = this.viewRange;
    this.gridRange = this.getGridRange(summaryData);
    const {left, right, bottom, top } = this.gridRange;
    //console.log('[对齐] summary网格范围',  {left, right, bottom, top })
    const vertices = [];
    
    // 水平网格线（内存）
    const yStep = this.calculateGridStep(bottom, top);
    for (let y = 0; y <= top; y += yStep) {
      vertices.push(left, y, right, y);

      if(y < 3){
        //
      }
    }
    
    // 垂直网格线（时间步）
    // this.currentStepStats.forEach(stat => {
    //   vertices.push(stat.step, bottom, stat.step, top);
    // });
    
    return { vertices, vertexCount: vertices.length / 2 };
  }

  calculateGridStep(min, max) {
    const range = max - min || 1;
    const exponent = Math.floor(Math.log10(range));
    const baseStep = Math.pow(10, exponent);
    
    // 选择更合适的步长
    if (range / baseStep > 20) return baseStep * 5;
    if (range / baseStep > 10) return baseStep * 2;
    return baseStep;
  }

  getGridRange(summaryData) {
    //const { settings, allocations } = data;
    //
    const maxMemory = summaryData.summary.maxMemoryUsage;
    const totalTimesteps = summaryData.stepStatistics.length;
    
    return {
        left: -1.0,
        right: totalTimesteps,
        bottom: 0 ,
        top: maxMemory 
  };
}


  // 注意之前css的paddign设置导致了这里的坐标轴偏移，现在已在lmem-view中将summary-cnavas的css设为0px
  draw2DElements() {
    if (!this.currentData) return;
    
    const ctx = this.canvas2d.ctx;
    ctx.save();
    
    ctx.strokeStyle = this.config.axisColor;
    ctx.fillStyle = this.config.axisColor;
    ctx.lineWidth = 1;
    ctx.font = this.config.labelFont;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    //ctx.imageSmoothingEnabled = false;
    
    this.drawAxes(ctx);
    this.drawAxisLabels(ctx);
    this.drawMemoryLabels(ctx);
    
    ctx.restore();
  }

  drawAxes(ctx) {
    const {left, right, bottom, top } = this.gridRange;
    

    const origin = this.worldToScreen([left, bottom]);
    const xEnd = this.worldToScreen([right, bottom]);
    const yEnd = this.worldToScreen([left, top]);
    

    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, 1, 1);

    ctx.beginPath();
    ctx.moveTo(origin[0], origin[1]);
    ctx.lineTo(xEnd[0], xEnd[1]);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(origin[0], origin[1]);
    ctx.lineTo(origin[0], yEnd[1]);
    ctx.stroke();
  }



  drawAxisLabels(ctx) {
    const { left, bottom, top } = this.viewRange;
    
    
    // X轴标签（时间步）
    this.currentData.stepStatistics.forEach(stat => {
      const pos = this.worldToScreenLx([stat.step, bottom]);
      //
      ctx.beginPath();
      ctx.moveTo(pos[0], pos[1]);
      ctx.lineTo(pos[0], pos[1] + 5);
      ctx.stroke();
      
      ctx.fillText(stat.step.toString(), pos[0], pos[1] + 15);
    });
    
    // Y轴标签（内存）
    const yStep = this.calculateGridStep(0, top);
    for (let y = 0; y <= top; y += yStep) {
      const pos = this.worldToScreenLy([left, y]);
      
      ctx.beginPath();
      ctx.moveTo(pos[0], pos[1]);
      ctx.lineTo(pos[0] - 5, pos[1]);
      ctx.stroke();
      
      ctx.textAlign = 'right';
      ctx.fillText(this.formatMemoryValue(y), pos[0] - 8, pos[1]);
      ctx.textAlign = 'center';
    }
  }

  drawMemoryLabels(ctx) {
    const { barWidth } = this.config;
    ctx.save();                       // 1. 保存现场
    ctx.font = '10px sans-serif';      // 2. 8px
    ctx.textAlign = 'center';         // 让文字居中更好看
    ctx.fillStyle = '#000';           // 也重置一下

    this.currentData.stepStatistics.forEach(stat => {
      if (stat.usedMemory > 0) {
        const pos = this.worldToScreen([stat.step, stat.usedMemory]);
        ctx.fillText(this.formatMemoryValue(stat.usedMemory), pos[0], pos[1] - 8);
      }
    });
    ctx.restore();
  }



worldToScreen([worldX, worldY]) {
  const { left, right, bottom, top } = this.viewRange;
  const w = this.canvas.clientWidth;
  const h = this.canvas.clientHeight;

  // 先归一化到 [-1,1]  与 WebGL 顶点 shader 输出一致
  const nx = (worldX - left) / (right - left) * 2 - 1;
  const ny = (worldY - bottom) / (top - bottom) * 2 - 1;

  // 再用 viewport 公式转像素
  const sx = (nx + 1) * w / 2;
  const sy = (ny + 1) * h / 2;   // 注意 WebGL 原点左下，canvas 2D 原点左上
  // 由于 canvas 2D 的 y 向下为正，而 WebGL viewport y 向上为正，
  // 需要把 y 翻转一次：
  return [sx, h - sy];
}

worldToScreenLx([worldX, worldY]) {
  const { left, right, bottom, top } = this.viewRange;
  const w = this.canvas.clientWidth;
  const h = this.canvas.clientHeight;

  // 先归一化到 [-1,1]  与 WebGL 顶点 shader 输出一致
  const nx = (worldX - left) / (right - left) * 2 - 1;
  const ny = (worldY - bottom) / (top - bottom) * 2 - 1;

  // 再用 viewport 公式转像素
  const sx = (nx + 1) * w / 2;
  const sy = (ny + 1) * h / 2 +  this.config.padding.bottom;   // 注意 WebGL 原点左下，canvas 2D 原点左上
  // 由于 canvas 2D 的 y 向下为正，而 WebGL viewport y 向上为正，
  // 我们需要把 y 翻转一次：
  return [sx, h - sy];
}

worldToScreenLy([worldX, worldY]) {
  const { left, right, bottom, top } = this.viewRange;
  const w = this.canvas.clientWidth;
  const h = this.canvas.clientHeight;

  // 先归一化到 [-1,1]  与 WebGL 顶点 shader 输出一致
  const nx = (worldX - left) / (right - left) * 2 - 1;
  const ny = (worldY - bottom) / (top - bottom) * 2 - 1;

  // 再用 viewport 公式转像素
  const sx = (nx + 1) * w / 2 + this.config.padding.left;
  const sy = (ny + 1) * h / 2;   // 注意 WebGL 原点左下，canvas 2D 原点左上
  // 由于 canvas 2D 的 y 向下为正，而 WebGL viewport y 向上为正，
  // 我们需要把 y 翻转一次：
  return [sx, h - sy];
}



  formatMemoryValue(bytes) {
    if (bytes === 0) return "0 B";
    
    const units = ['B'];//  ,'KB', 'MB', 'GB'
    let unitIndex = 0;
    let value = bytes;
    
    while (value >= 1024 && unitIndex < units.length - 1) {
      value /= 1024;
      unitIndex++;
    }
    
    const precision = value < 10 ? 2 : value < 100 ? 1 : 0;
    return `${value.toFixed(precision)} ${units[unitIndex]}`;
  }

  // // 每次渲染前，把 viewMatrix 反推出真正的可见范围
  // updateViewRangeFromMatrix() {
  //     const m = this.viewMatrix;
  //     // 正交矩阵 ortho(l,r,b,t) 的逆可直接给出四元
  //     const l = (-1 - m[12]) / m[0];
  //     const r = ( 1 - m[12]) / m[0];
  //     const b = (-1 - m[13]) / m[5];
  //     const t = ( 1 - m[13]) / m[5];
  //     this.viewRange = { left: l, right: r, bottom: b, top: t };
  // }

}