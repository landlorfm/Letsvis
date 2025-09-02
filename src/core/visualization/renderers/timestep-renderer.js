import { mat4, vec4 } from 'gl-matrix';
import { ColorUtils } from '../../../utils/color-utils'; 
import { zoom } from 'd3';

export class TimestepRenderer {
  constructor({
    canvas,
    tooltipElement,
    onOperationSelect = () => {},
    onOperationHover = () => {}
  }) {
    this.canvas = canvas;
    this.gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    this.tooltipElement = tooltipElement;
    this.onOperationSelect = onOperationSelect;
    this.onOperationHover = onOperationHover;

    // WebGL 状态
    this.program = null;
    this.overlayProgram = null;
    this.buffers = {};
    this.uniforms = {};
    this.overlayUniforms = {};
    this.attributes = {};
    this.overlayAttributes = {};
    
    // 矩阵系统
    this.projectionMatrix = mat4.create();
    this.viewMatrix = mat4.create();
    this.viewProjectionMatrix = mat4.create();
    this.orthoMatrix = mat4.create();
    
    // 覆盖层 Canvas
    this.overlayCanvas = document.createElement('canvas');
    this.overlayCtx = this.overlayCanvas.getContext('2d');
    
    // 纹理
    this.overlayTexture = null;
    
    // 保持原有的状态和布局参数
    this.data = null;
    this.zoomLevel = 1.0;
    this.viewOffset = 0;
    this.hoveredOperation = null;
    this.selectedOperations = new Set();
    this.dependencies = {};
    this.animationFrame = null;
    
    this.lanes = [
       { id: 'stores', label: '存储操作', color: [0.882, 0.341, 0.349, 1.0] },
       { id: 'compute', label: '计算操作', color: [0.305, 0.557, 0.655, 1.0] },
       { id: 'loads', label: '加载操作', color: [0.949, 0.557, 0.173, 1.0] },
    ];
    


    this.fixedLeft = 80;
    this.translateX = 0;


    // 在构造函数中统一定义所有坐标参数
    this.WORLD_COORDS = {
    AXIS_Y: -3.0,           // 时间轴Y位置
    TOP_Y: 1.2,             // 顶部Y位置
    LANE_START_Y: -1.8,     // 第一个泳道的Y起点
    LANE_HEIGHT: 0.8,       // 泳道高度
    LABEL_OFFSET_X: -0.5,   // 标签X偏移
    TICK_LENGTH: 0.2        // 刻度长度
    };

    // 统一矩形纵坐标参数
    this.RECT_COORDS = {
    LANE_START_Y: -1.8,     // 第一个泳道的Y起点（与WORLD_COORDS保持一致）
    LANE_HEIGHT: 0.8,       // 泳道高度（与WORLD_COORDS保持一致）
    RECT_HEIGHT_RATIO: 0.5, // 矩形高度占泳道高度的比例
    LANE_MARGIN: 0.2        // 泳道间距
    };

    //this.op._worldRect ={}

    this.timeStepBaseWidth = 50;//50;
    this.stepInterval = 1
    this.minZoom = 0.0001;
    this.maxZoom = 5.0;

    // 交互状态
    this.isDragging = false;
    this.dragStartX = 0;
    this.startViewOffset = 0;
    this.dependencies = {
      downstream: {}, // opId -> [依赖项] (当前操作的下游依赖)
      upstream: {}    // opId -> [依赖源] (指向当前操作的上游依赖)
    };

    if (this.gl) {
      this.initWebGL();
    } else {
      console.error('WebGL not supported');
    }
    
    this.bindEvents();
    this.resize();
  }

  initWebGL() {
    const gl = this.gl;

  this.gl.enable(this.gl.POLYGON_OFFSET_FILL);
  this.gl.polygonOffset(1.0, 1.0);
  
  // 禁用抗锯齿
  this.gl.disable(this.gl.SMOOTH);
  this.gl.disable(this.gl.DITHER);

    // 主渲染程序
    const vsSource = `
      attribute vec2 aPosition;
      attribute vec4 aColor;
      uniform mat4 uViewProjectionMatrix;
      varying vec4 vColor;
      
      void main() {
        gl_Position = uViewProjectionMatrix * vec4(aPosition, 0.0, 1.0);
        vColor = aColor;
      }
    `;

    const fsSource = `
      precision mediump float;
      varying vec4 vColor;
      
      void main() {
        gl_FragColor = vColor ;
      }
    `;

    this.program = this.createProgram(vsSource, fsSource);

    // 覆盖层渲染程序（用于绘制 Canvas 2D 内容）
    const overlayVsSource = `
      attribute vec2 aPosition;
      attribute vec2 aTexCoord;
      varying vec2 vTexCoord;
      
      void main() {
        gl_Position = vec4(aPosition, 0.0, 1.0);
        vTexCoord = aTexCoord;
      }
    `;

    const overlayFsSource = `
      precision mediump float;
      varying vec2 vTexCoord;
      uniform sampler2D uTexture;
      
      void main() {
        gl_FragColor = texture2D(uTexture, vTexCoord);
      }
    `;

    this.overlayProgram = this.createProgram(overlayVsSource, overlayFsSource);

    // 获取uniform和attribute位置
    gl.useProgram(this.program);
    this.uniforms.viewProjectionMatrix = gl.getUniformLocation(this.program, 'uViewProjectionMatrix');
    this.attributes.position = gl.getAttribLocation(this.program, 'aPosition');
    this.attributes.color = gl.getAttribLocation(this.program, 'aColor');

    gl.useProgram(this.overlayProgram);
    this.overlayUniforms.texture = gl.getUniformLocation(this.overlayProgram, 'uTexture');
    this.overlayAttributes.position = gl.getAttribLocation(this.overlayProgram, 'aPosition');
    this.overlayAttributes.texCoord = gl.getAttribLocation(this.overlayProgram, 'aTexCoord');

    // 创建缓冲区
    this.buffers.operations = gl.createBuffer();
    this.buffers.lanes = gl.createBuffer();
    this.buffers.overlay = gl.createBuffer();
    this.buffers.overlayTexCoords = gl.createBuffer();

    // 创建纹理
    this.overlayTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.overlayTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    // 设置混合
    // gl.enable(gl.BLEND);
    // gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  }

  createProgram(vsSource, fsSource) {
    const gl = this.gl;
    const vertexShader = this.compileShader(gl.VERTEX_SHADER, vsSource);
    const fragmentShader = this.compileShader(gl.FRAGMENT_SHADER, fsSource);
    
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error('Program linking error: ' + gl.getProgramInfoLog(program));
    }
    
    return program;
  }

  compileShader(type, source) {
    const gl = this.gl;
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error('Shader compilation error: ' + gl.getShaderInfoLog(shader));
    }
    
    return shader;
  }


resize() {
  const dpr = window.devicePixelRatio || 1;

  // 1. 物理尺寸
  this.canvas.width  = this.canvas.clientWidth  * dpr;
  this.canvas.height = this.canvas.clientHeight * dpr;
  this.overlayCanvas.width  = this.canvas.width;
  this.overlayCanvas.height = this.canvas.height;

  // 2. WebGL 视口：只画右侧可滚动区域
  const glLeft = this.fixedLeft * dpr;
  const glWidth = this.canvas.width - glLeft;
  this.gl.viewport(glLeft, 0, glWidth, this.canvas.height);

//   // 3. 触发重绘
//   if (this.data) this.render();
  // 重新计算后限制视图偏移

   // 重新计算后限制视图偏移
  if (this.data) {
    const canvasWidth = (this.canvas.width - this.fixedLeft * dpr) / dpr;
    const pixelsPerStep = this.timeStepBaseWidth * this.zoomLevel;
    const visibleSteps = canvasWidth / pixelsPerStep;
    const maxOffset = Math.max(0, this.data.length - visibleSteps);
    this.viewOffset = Math.min(maxOffset, this.viewOffset);
  }
  
  this.render();

}



  setData(data) {
    console.log('setData called with', data); 
    this.data = data;
    this.viewOffset = 0;  // 重置视图偏移
    this.analyzeDependencies();
    console.log('Dependencies-downstream raw:', JSON.parse(JSON.stringify(this.dependencies.downstream)));
    console.log('Dependencies-upstream   raw:', JSON.parse(JSON.stringify(this.dependencies.upstream)));
    this.render();
  }

//   analyzeDependencies() {
//     this.dependencies = {};
//     if (!this.data) return;

//     for (let ts = 0; ts < this.data.length; ts++) {
//       const timestep = this.data[ts];
//        ['loads', 'compute',  'stores'].forEach(type => {
//         if (timestep[type]) {
//           timestep[type].forEach(op => {
//             this.dependencies[op.id] = this.findDependencies(op.id, ts);
//           });
//         }
//       });
//     }
//   }

//   findDependencies(opId, currentTs) {
//     const deps = [];
//     if (!this.data) return deps;

//     for (let ts = 0; ts < currentTs; ts++) {
//       const timestep = this.data[ts];
//       ['loads', 'compute',  'stores'].forEach(type => {
//         if (timestep[type]) {
//           timestep[type].forEach(op => {
//             if (op.id === opId) {
//               deps.push({ type, ts, op });
//             }
//           });
//         }
//       });
//     }

//     return deps;
//   }



updateMatrices() {
  if (!this.data) return;

  const dpr = window.devicePixelRatio || 1;
  const padding = 2;
  
  // 计算画布的实际世界坐标范围
  const canvasWidth = (this.canvas.width - this.fixedLeft * dpr) / dpr;
  const pixelsPerStep = this.timeStepBaseWidth * this.zoomLevel;
  const visibleSteps = canvasWidth / pixelsPerStep;

    const maxOffset = this.data.length + 1;   // 允许负值
    this.viewOffset = Math.max(-1, Math.min(maxOffset, this.viewOffset));

  // 动态计算x轴范围
  const worldLeft = Math.max(-padding, this.viewOffset - padding);
  const worldRight = Math.min(this.data.length + padding, this.viewOffset + visibleSteps + padding);

  // y轴范围固定不变
    const worldBottom = this.WORLD_COORDS.AXIS_Y - 0.5; // 比时间轴稍低
    const worldTop = this.WORLD_COORDS.TOP_Y + 0.5;     // 比顶部稍高

    // 投影矩阵
  mat4.ortho(this.projectionMatrix, 
      worldLeft, worldRight, 
      worldBottom, worldTop, 
      -1, 1
  );

   // 关键：确保时间步0始终出现在固定区域右侧
  mat4.identity(this.viewMatrix);
  
  // 计算时间步0在投影矩阵中的位置
  const timeStep0NDC = (0 - worldLeft) / (worldRight - worldLeft) * 2 - 1;
  
  // 我们希望时间步0出现在固定区域的右侧
  const desiredTimeStep0Pos = -1 + (this.fixedLeft / (canvasWidth + this.fixedLeft)) * 2;
  
  // 调整平移量，使时间步0出现在期望的位置
  const translateX = (desiredTimeStep0Pos - timeStep0NDC) * (worldRight - worldLeft) / 2;
  mat4.translate(this.viewMatrix, this.viewMatrix, [translateX, 0, 0]);
  
  // 视图投影矩阵
  mat4.multiply(this.viewProjectionMatrix, this.projectionMatrix, this.viewMatrix);


//   // 关键修改：计算Y轴位置（时间步0）应该出现在屏幕左侧固定区域
//   // 计算时间步0在投影矩阵中的位置
//   const timeStep0NDC = (0 - worldLeft) / (worldRight - worldLeft) * 2 - 1;
  
//   // 我们希望时间步0出现在固定区域的右侧（留出边距）
//   const desiredMargin = 0.1; // NDC坐标中的边距
//   const desiredTimeStep0Pos = -1 + desiredMargin * 2;
  
//   // 调整平移量，使时间步0出现在期望的位置
//   mat4.identity(this.viewMatrix);
//   const translateX = (desiredTimeStep0Pos - timeStep0NDC) * (worldRight - worldLeft) / 2;
//   mat4.translate(this.viewMatrix, this.viewMatrix, [translateX, 0, 0]);
  
//   // 视图投影矩阵
//   mat4.multiply(this.viewProjectionMatrix, this.projectionMatrix, this.viewMatrix);


//   // 视图投影矩阵
//   mat4.multiply(this.viewProjectionMatrix, this.projectionMatrix, this.viewMatrix);


//   console.log('Y轴位置调试:', {
//     timeStep0NDC,
//     desiredTimeStep0Pos,
//     translateX,
//     worldLeft, worldRight
//   });
}


/**
 * 精确的世界坐标到屏幕坐标转换
 */
worldToScreen(worldX, worldY) {
  const dpr = window.devicePixelRatio || 1;
  
  // 将世界坐标转换为裁剪空间坐标
  const clipPos = vec4.fromValues(worldX, worldY, 0, 1);
  vec4.transformMat4(clipPos, clipPos, this.viewProjectionMatrix);
  
  // 透视除法得到NDC坐标 (-1 to 1)
  const ndcX = clipPos[0] / clipPos[3];
  const ndcY = clipPos[1] / clipPos[3];
  
  // 转换为屏幕坐标（考虑WebGL视口）
  const glLeft = 0;//this.fixedLeft * dpr;
  const glWidth = this.canvas.width - glLeft;
  const glHeight = this.canvas.height;
  
  const screenX = glLeft + (ndcX + 1) * 0.5 * glWidth;
  const screenY = (1 - ndcY) * 0.5 * glHeight;
  
  return [screenX*dpr, screenY*dpr];
}

/**
 * 屏幕坐标到世界坐标转换
 */
screenToWorld(cssX, cssY) {
  const dpr = window.devicePixelRatio || 1;
  
  // CSS像素 → 物理像素
  const pxX = cssX / dpr ;
  const pxY = cssY / dpr;
  
  // 计算WebGL视口范围
  const glLeft = 0;//this.fixedLeft * dpr;
  const glWidth = this.canvas.width - glLeft;
  const glHeight = this.canvas.height;
  
  // 归一化到NDC (-1 to 1)
  const ndcX = 2 * (pxX - glLeft) / glWidth - 1;
  const ndcY = 1 - 2 * pxY / glHeight; // Y轴翻转
  
  // NDC → 裁剪空间
  const clipPos = vec4.fromValues(ndcX, ndcY, 0, 1);
  
  // 逆变换到世界空间
  const invVP = mat4.create();
  mat4.invert(invVP, this.viewProjectionMatrix);
  vec4.transformMat4(clipPos, clipPos, invVP);
  
  // 透视除法
  const worldX = clipPos[0] / clipPos[3];
  const worldY = clipPos[1] / clipPos[3];
  
  return [worldX, worldY];
}




  render() {
    if (!this.gl || !this.data) return;


    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
    }


    this.animationFrame = requestAnimationFrame(() => {

        this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        
        this.gl.clearColor(0.98, 0.98, 0.98, 1.0);
        this.gl.disable(this.gl.DEPTH_TEST); // 禁用深度测试
        this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
        // 启用混合
        this.gl.enable(this.gl.BLEND);
        this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA); 

        this.updateMatrices();

        // 绘制泳道背景
        //this.drawLanes();
        
        // 绘制操作
        this.drawOperations();
        
        // 绘制覆盖层（时间轴和依赖关系）
        this.drawOverlay();

        console.log(
            {
                zoomLevel : this.zoomLevel,
                viewOffset: this.viewOffset
            }
        )

    });
  }



  drawLanes() {
    const gl = this.gl;
    gl.useProgram(this.program);
    gl.uniformMatrix4fv(this.uniforms.viewProjectionMatrix, false, this.viewProjectionMatrix);

    const vertices = [];
    const colors = [];
    
    this.lanes.forEach((lane, index) => {
    const worldLabelX = this.RECT_COORDS.LABEL_OFFSET_X;
    const worldLabelY = this.RECT_COORDS.LANE_START_Y + 
                       index * this.RECT_COORDS.LANE_HEIGHT + 
                       this.RECT_COORDS.LANE_HEIGHT * this.RECT_COORDS.RECT_HEIGHT_RATIO / 2;
    const y = this.worldToScreen(worldLabelX, worldLabelY)[1];
    const height = this.RECT_COORDS.LANE_HEIGHT * this.RECT_COORDS.RECT_HEIGHT_RATIO;
    //   const y = index - 1.5; // 转换为世界坐标
    //   const height = 0.8;
      
      const laneVertices = [
        -100, y,
         100, y,
        -100, y + height,
        -100, y + height,
         100, y,
         100, y + height
      ];
      
      vertices.push(...laneVertices);
      
      const laneColor = [...lane.color];
      laneColor[3] = 0.3;
      for (let i = 0; i < 6; i++) {
        colors.push(...laneColor);
      }
    });
    
    this.drawGeometry(vertices, colors, this.buffers.lanes);
  }

  drawOperations() {
    const gl = this.gl;
    gl.useProgram(this.program);
    gl.uniformMatrix4fv(this.uniforms.viewProjectionMatrix, false, this.viewProjectionMatrix);

    const vertices = [];
    const colors = [];
    

    const { startTs, endTs } = this.getVisibleTimeStepRange();

    for (let ts = startTs; ts <= endTs; ts++) {
      const timestep = this.data[ts];
      if (!timestep) continue;

       [ 'stores','loads', 'compute'].forEach(type => {
        if (timestep[type]) {
          timestep[type].forEach(op => {
            this.addOperationGeometry(vertices, colors, op, type, ts);
          });
        }
      });
    }
    
    //this.drawGeometry(vertices, colors, this.buffers.operations);
    if (vertices.length > 0) {
    console.log('绘制操作矩形');
    this.drawGeometry(vertices, colors, this.buffers.operations);
  }
  }


  addOperationGeometry(vertices, colors, op, type, ts) {
    
    const laneIndex = this.lanes.findIndex(l => l.id === type);
    if (laneIndex === -1) return;


    // 使用统一的坐标系统, y：
    const y = this.RECT_COORDS.LANE_START_Y + laneIndex * this.RECT_COORDS.LANE_HEIGHT;
    const height = this.RECT_COORDS.LANE_HEIGHT * this.RECT_COORDS.RECT_HEIGHT_RATIO;
    
    // const duration = 0.2;
    // const x = ts;
    // const width = duration;

    // 获取当前时间步该类型的操作数量
    const timestep = this.data[ts];
    const opCount = timestep[type] ? timestep[type].length : 1;
    const opIndex = timestep[type].indexOf(op);
    
    // 计算每个操作的宽度（均分一个时间步）
    const baseWidth = 1.0; // 一个时间步的宽度
    const opWidth = baseWidth / opCount;
    
    // 计算当前操作的起始位置
    const x = ts + opIndex * opWidth;
    const width = opWidth;

    // console.log(`矩形位置: TS=${ts}, 世界X=${x}, 屏幕X=${this.worldToScreen(x, y)[0].toFixed(1)}`);

    //const [px, py] = this.worldToPhysical(ts, y);
    //console.log(`矩形左下角 物理像素`, { ts, worldX: ts, px, py });


    // let baseColor = ColorUtils.getColorForOperator(op.id);   // 算子级颜色
    // if (this.hoveredOperation && this.hoveredOperation.id === op.id) {
    //     baseColor = ColorUtils.getHighlightColor(baseColor, 0.5);
    // } else if (this.selectedOperations.has(op.id)) {
    //     baseColor = ColorUtils.getSelectedColor(baseColor, 0.15);
    // }


     //确保 hoveredOperation 包含 id 属性
    const isHovered = this.hoveredOperation && 
                    this.hoveredOperation.op && 
                    this.hoveredOperation.op.id === op.id;
    
    const isSelected = this.selectedOperations.has(op.id);
    
    let baseColor = ColorUtils.getColorForOperator(op.id);
    
    if (isHovered) {
        baseColor = [1.0, 0, 0, 0.3]; // 强制使用雾红色测试高亮
        // baseColor = ColorUtils.getHighlightColor(baseColor, 0.3);
    } else if (isSelected) {
        baseColor = [0, 1, 0, 0.6]; // 强制使用绿色测试选中
        // baseColor = ColorUtils.getSelectedColor(baseColor, 0.15);
    }
    
    const opVertices = [
      x, y,
      x + width, y,
      x, y + height,
      x, y + height,
      x + width, y,
      x + width, y + height
    ];
    
    vertices.push(...opVertices);
    
    for (let i = 0; i < 6; i++) {
      colors.push(...baseColor);
    }

    //console.log('画布：', this.canvas.height, this.canvas.width);
    //console.log(`世界坐标: (${x}, ${y}), 屏幕坐标: ${this.worldToScreen(x, y)}`);
    }





  drawGeometry(vertices, colors, buffer) {
    const gl = this.gl;

     console.log('绘制几何体 - 顶点数:', vertices.length / 2);

    
    const interleavedData = new Float32Array(vertices.length / 2 * 6);
    for (let i = 0; i < vertices.length / 2; i++) {
      interleavedData[i * 6] = vertices[i * 2];
      interleavedData[i * 6 + 1] = vertices[i * 2 + 1];
      interleavedData[i * 6 + 2] = colors[i * 4];
      interleavedData[i * 6 + 3] = colors[i * 4 + 1];
      interleavedData[i * 6 + 4] = colors[i * 4 + 2];
      interleavedData[i * 6 + 5] = colors[i * 4 + 3];
    }
    
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, interleavedData, gl.DYNAMIC_DRAW);
    
    gl.enableVertexAttribArray(this.attributes.position);
    gl.enableVertexAttribArray(this.attributes.color);
    gl.vertexAttribPointer(this.attributes.position, 2, gl.FLOAT, false, 24, 0);
    gl.vertexAttribPointer(this.attributes.color, 4, gl.FLOAT, false, 24, 8);
    
    gl.drawArrays(gl.TRIANGLES, 0, vertices.length / 2);

  }





drawFixedLeftPanel() {
  const ctx = this.overlayCtx;
  const dpr = window.devicePixelRatio || 1;
  const left = 0;                       // 固定区域从 0 开始
  const width = this.fixedLeft * dpr;   // 固定宽度
  const height = this.overlayCanvas.height;

  ctx.save();
  ctx.beginPath();
  ctx.rect(left, 0, width, height);
  ctx.clip();                           // 只在这一块画

  ctx.fillStyle = '#f7f7f7';            // 可选：背景色
  ctx.fillRect(left, 0, width, height);

  // 画泳道标签
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.font = `${16 * dpr}px Arial`;
  ctx.fillStyle = '#333';

  this.lanes.forEach((lane, idx) => {
    // 把泳道中心 Y 转成屏幕坐标（和泳道矩形保持一致）
    const worldY = this.RECT_COORDS.LANE_START_Y +
                   idx * this.RECT_COORDS.LANE_HEIGHT +
                   this.RECT_COORDS.LANE_HEIGHT * this.RECT_COORDS.RECT_HEIGHT_RATIO / 2;
    const screenY = this.worldToScreen(0, worldY)[1]; // 用 0 也行，因为 y 固定
    ctx.fillText(lane.id, width - 10 * dpr, screenY);
  });

  // 画“时间步”标题
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = `${14 * dpr}px Arial`;
  const axisWorldY = this.WORLD_COORDS.AXIS_Y - 0.3;
  const axisScreenY = this.worldToScreen(0, axisWorldY)[1];
  ctx.fillText('TimeSteps', left + 10 * dpr, axisScreenY);


  // 绘制Y轴线 - 在ts=0位置，不论缩放或拖拽都不移动

  ctx.restore();
}



drawAlignmentLinesWithCanvas2D() {
  const ctx = this.overlayCtx;
  const dpr = window.devicePixelRatio || 1;
  
  if (!this.data || this.data.length === 0) return;
  

const { startTs, endTs } = this.getVisibleTimeStepRange();
  
  // 在世界坐标系中定义线的起点和终点
  const worldTopY = this.WORLD_COORDS.TOP_Y;
  const worldBottomY = this.WORLD_COORDS.AXIS_Y;
  
  ctx.strokeStyle = '#544f4fff';
  ctx.lineWidth = 1 * dpr;
  ctx.setLineDash([2 * dpr, 2 * dpr]);
  

  for (let ts = startTs; ts <= endTs; ts++) {
    const [lineTopX, lineTopY] = this.worldToScreen(ts, worldTopY);
    const [lineBottomX, lineBottomY] = this.worldToScreen(ts, worldBottomY);
  
    ctx.beginPath();
    ctx.moveTo(lineTopX, lineTopY);
    ctx.lineTo(lineBottomX, lineBottomY);
    ctx.stroke();

    //   const [linePx, linePy] = this.worldToPhysical(ts, worldTopY);
    // console.log(`对齐线同一行 物理像素`, { ts, worldX: ts, linePx, linePy });
  }

  
  ctx.setLineDash([]);
}




drawTimelineWithCanvas2D() {
  const ctx = this.overlayCtx;
  const dpr = window.devicePixelRatio || 1;
  
  if (!this.data || this.data.length === 0) return;


const { startTs, endTs } = this.getVisibleTimeStepRange();
  
  //console.log(`可见时间步范围: ${startTs} 到 ${endTs}, 总步数: ${endTs - startTs + 1}`);
  
  // 在世界坐标系中定义时间轴位置
  const worldAxisY = this.WORLD_COORDS.AXIS_Y;
  
  // 转换时间轴起点和终点到屏幕坐标
  const [axisStartX, axisStartY] = this.worldToScreen(startTs, worldAxisY);
  const [axisEndX, axisEndY] = this.worldToScreen(endTs, worldAxisY);
  
  // 绘制时间轴基线
  ctx.beginPath();
  ctx.moveTo(axisStartX, axisStartY);
  ctx.lineTo(axisEndX, axisEndY);
  ctx.strokeStyle = '#120c0cff';
  ctx.lineWidth = 1 * dpr;
  ctx.stroke();
  
  // 计算合适的时间步间隔（避免标签重叠）
  const stepInterval = this.calculateStepInterval(endTs - startTs);
  
  // 绘制刻度和标签
  ctx.font = `${12 * dpr}px Arial`;
  ctx.fillStyle = '#333';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  
  for (let ts = startTs; ts <= endTs; ts++) {
    const [tickX, tickY] = this.worldToScreen(ts, worldAxisY);
    const [labelX, labelY] = this.worldToScreen(ts, worldAxisY - 0.3);

    //console.log(`刻度位置: TS=${ts}, 世界X=${ts}, 屏幕X=${tickX.toFixed(1)}`);
    
    const isMajorTick = ts % stepInterval === 0;
    const isFirstOrLast = ts === startTs || ts === endTs;
    
    if (isMajorTick || isFirstOrLast) {
      // 绘制刻度线
      ctx.beginPath();
      const tickHeight = isMajorTick ? 10 * dpr : 6 * dpr;
      ctx.moveTo(tickX, tickY - tickHeight);
      ctx.lineTo(tickX, tickY);
      ctx.strokeStyle = isMajorTick ? '#444' : '#888';
      ctx.lineWidth = isMajorTick ? 1.5 * dpr : 1 * dpr;
      ctx.stroke();
      
      // 绘制标签
      if (isMajorTick) {
        ctx.fillText(`T${ts}`, labelX, labelY + 5 * dpr);
      }
    }
  }
  this.debugCoordinateSystems();
  

}

// 优化显示，动态显示刻度
calculateStepInterval(visibleSteps) {
  if (visibleSteps <= 0) return 1;
  
  // 根据可见步数和缩放级别计算合适的间隔
  const minLabelWidth = 80; // 最小标签宽度（像素）
  const visibleWidth = this.canvas.width - this.fixedLeft * window.devicePixelRatio;
  const pixelsPerStep = visibleWidth / visibleSteps;
  
  let interval = 1;
  
  if (pixelsPerStep < minLabelWidth) {
    // 如果步长太密，增加间隔
    interval = Math.ceil(minLabelWidth / pixelsPerStep);
  }
  
  // 确保间隔是1、2、5、10等友好数字
  if (interval > 20) interval = 20;
  else if (interval > 10) interval = 10;
  else if (interval > 5) interval = 5;
  else if (interval > 2) interval = 2;
  
  return interval;
}



// 在 drawOverlay 方法中添加依赖关系绘制
drawOverlay() {
  const dpr = window.devicePixelRatio || 1;
  this.overlayCtx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);

  // 先画左侧固定区域
  this.drawFixedLeftPanel();          

  // 再画右侧滚动区域（原来的时间轴、对齐线）
  this.overlayCtx.save();
  this.overlayCtx.beginPath();
  this.overlayCtx.rect(this.fixedLeft * dpr, 0,
                       this.overlayCanvas.width - this.fixedLeft * dpr,
                       this.overlayCanvas.height);
  this.overlayCtx.clip();
  this.drawTimelineWithCanvas2D();
  this.drawAlignmentLinesWithCanvas2D();
  
  // 新增：绘制依赖关系
  this.drawDependenciesWithCanvas2D();
  
  this.overlayCtx.restore();

  this.renderOverlayTexture();
}

  analyzeDependencies() {
    // 重置依赖关系
    this.dependencies = { downstream: {}, upstream: {} };
    
    // 建立双向依赖
    for (let ts = 0; ts < this.data.length; ts++) {
      // 处理所有操作类型
      ['loads', 'compute', 'stores'].forEach(type => {
        if (!this.data[ts][type]) return;
        
        this.data[ts][type].forEach(op => {
          // 1. 查找下游依赖
          const downstream = this.findDownstreamDependencies(op, ts);
          if (downstream.length) {
            this.dependencies.downstream[op.id] = downstream;
            
            // 2. 同时建立上游依赖
            downstream.forEach(dep => {
              if (!this.dependencies.upstream[dep.op.id]) {
                this.dependencies.upstream[dep.op.id] = [];
              }
              this.dependencies.upstream[dep.op.id].push({
                type,
                ts,
                op
              });
            });
          }
        });
      });
    }
  }

  findDownstreamDependencies(op, currentTs) {
    const dependencies = [];
    
    // 查找所有后续时间步
    for (let ts = currentTs + 1; ts < this.data.length; ts++) {
      // 检查所有操作类型
      ['loads', 'compute', 'stores'].forEach(type => {
        if (!this.data[ts][type]) return;
        
        const dependentOp = this.data[ts][type].find(
          candidate => candidate.id === op.id
        );
        
        if (dependentOp) {
          dependencies.push({ type, ts, op: dependentOp });
        }
      });
    }
    
    return dependencies;
  }


drawDependenciesWithCanvas2D() {
    console.log('drawDependenciesWithCanvas2D: selectedOperations =', this.selectedOperations);
    const dpr = window.devicePixelRatio || 1;
  this.selectedOperations.forEach(opId => {
    // 直接获取下游依赖
    if (this.dependencies.downstream[opId]) {
      this.dependencies.downstream[opId].forEach(dep => {
        const srcInfo = this.findOperationById(opId);
        const dstInfo = { op: dep.op, type: dep.type, ts: dep.ts };
        this.drawDependencyArrow(srcInfo, dstInfo, dpr, '#ff6b6b', 2);
      });
    }
    
    // 直接获取上游依赖
    if (this.dependencies.upstream[opId]) {
      this.dependencies.upstream[opId].forEach(src => {
        const srcInfo = { op: src.op, type: src.type, ts: src.ts };
        const dstInfo = this.findOperationById(opId);
        this.drawDependencyArrow(srcInfo, dstInfo, dpr, '#4ecdc4', 2);
      });
    }
  });
}



/**
 * 画一条箭头：srcInfo -> dstInfo
 * @param {*} srcInfo  { op, type, ts }
 * @param {*} dstInfo  { op, type, ts }
 */
drawDependencyArrow(srcInfo, dstInfo, dpr, color, width) {
  const src = this._getOpCenter(srcInfo);
  const dst = this._getOpCenter(dstInfo);
  if (!src || !dst) return;

  const ctx = this.overlayCtx;
  ctx.beginPath();
  ctx.moveTo(src.x, src.y);

  const control = Math.abs(dst.x - src.x) * 0.4;
  ctx.bezierCurveTo(
    src.x + control, src.y,
    dst.x - control, dst.y,
    dst.x, dst.y
  );


  ctx.strokeStyle = color;
  ctx.lineWidth = width * dpr;
  ctx.setLineDash([]);
  ctx.stroke();

  // 箭头
  const angle = Math.atan2(dst.y - src.y, dst.x - src.x);
  ctx.save();
  ctx.translate(dst.x, dst.y);
  ctx.rotate(angle);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-8 * dpr, -4 * dpr);
  ctx.lineTo(-8 * dpr, 4 * dpr);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/**
 * 根据 opInfo 计算中心屏幕坐标
 */
_getOpCenter({ op, type, ts }) {
  const laneIdx = this.lanes.findIndex(l => l.id === type);
  if (laneIdx === -1) return null;

  const timestep = this.data[ts];
  const opCount = timestep[type] ? timestep[type].length : 1;
  const opIdx   = timestep[type] ? timestep[type].indexOf(op) : 0;
  const opWidth = 1.0 / opCount;
  const worldX  = ts + opIdx * opWidth + opWidth;

  const worldY = this.RECT_COORDS.LANE_START_Y +
                 laneIdx * this.RECT_COORDS.LANE_HEIGHT +
                 this.RECT_COORDS.LANE_HEIGHT * this.RECT_COORDS.RECT_HEIGHT_RATIO / 2;

  const [x, y] = this.worldToScreen(worldX, worldY);
  return { x, y };
}




// // 新增方法：查找哪些操作依赖于此操作
// findOperationsThatDependOn(opId) {
//   const dependents = [];
  
//   // 遍历所有依赖关系，查找指向该操作的操作
//   Object.entries(this.dependencies).forEach(([sourceOpId, deps]) => {
//     deps.forEach(dep => {
//       if (dep.op.id === opId) {
//         const sourceOpInfo = this.findOperationById(sourceOpId);
//         if (sourceOpInfo) {
//           dependents.push(sourceOpInfo);
//         }
//       }
//     });
//   });
  
//   return dependents;
// }




  drawLaneLabelsWithCanvas2D() {
    const ctx = this.overlayCtx;
    const dpr = window.devicePixelRatio || 1;

    this.lanes.forEach((lane, index) => {      
    // const y = this.laneStartY + (2.5-index) * this.pxPerLane; // + this.laneHeight * dpr / 2;
        // 使用统一的矩形坐标计算标签位置
    const worldLabelY = this.RECT_COORDS.LANE_START_Y + 
                       index * this.RECT_COORDS.LANE_HEIGHT + 
                       this.RECT_COORDS.LANE_HEIGHT * this.RECT_COORDS.RECT_HEIGHT_RATIO / 2;
    
    // 标签X位置稍微向左偏移
    const worldLabelX = -1.0;
    
    const [screenX, screenY] = this.worldToScreen(worldLabelX, worldLabelY);

        ctx.fillStyle = '#333';
        ctx.font = `${16 * dpr}px Arial`;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(lane.id,  screenX, screenY);
    });
  }

  renderOverlayTexture() {
    const gl = this.gl;
    
    // 上传 Canvas 2D 内容到纹理
    gl.bindTexture(gl.TEXTURE_2D, this.overlayTexture);

    //console.log('upload texture', this.overlayCanvas.width, this.overlayCanvas.height);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.overlayCanvas);

    
    // 切换到覆盖层程序
    gl.useProgram(this.overlayProgram);
    gl.uniform1i(this.overlayUniforms.texture, 0);
    
    // 绘制全屏四边形
    const vertices = new Float32Array([
      -1, -1, 0, 1,
       1, -1, 1, 1,
      -1,  1, 0, 0,
      -1,  1, 0, 0,
       1, -1, 1, 1,
       1,  1, 1, 0
    ]);
    
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.overlay);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
    
    gl.vertexAttribPointer(this.overlayAttributes.position, 2, gl.FLOAT, false, 16, 0);
    gl.vertexAttribPointer(this.overlayAttributes.texCoord, 2, gl.FLOAT, false, 16, 8);
    
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    
    gl.enable(gl.BLEND);
  }


  bindEvents() {
    this.canvas.addEventListener('wheel', this.handleWheel.bind(this));
    this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
    this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
    this.canvas.addEventListener('mouseup', this.handleMouseUp.bind(this));
    this.canvas.addEventListener('mouseleave', this.handleMouseLeave.bind(this));
    this.canvas.addEventListener('click', this.handleClick.bind(this));
    window.addEventListener('resize', this.resize.bind(this));
  }




handleWheel(e) {
  e.preventDefault();
  
  const rect = this.canvas.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  
  // 获取鼠标位置对应的时间步（缩放前）
  const mouseWorldXBefore = this.screenToWorld(mouseX, 0)[0];
  
  const delta = e.deltaY > 0 ? -0.1 : 0.1;
  const oldZoom = this.zoomLevel;
  this.zoomLevel = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoomLevel + delta));
  
  // 计算鼠标指向的时间步在缩放后的位置
  // 由于缩放改变了显示的时间步范围，需要调整viewOffset来保持鼠标位置
  const zoomFactor = oldZoom / this.zoomLevel; // 注意这里是倒数
  const mouseWorldXAfter = mouseWorldXBefore;
  
  // 调整viewOffset，使鼠标指向的时间步保持屏幕位置不变
  this.viewOffset = this.viewOffset + (mouseWorldXBefore - mouseWorldXAfter) * zoomFactor;

//   // 限制视图偏移范围
//   const dpr = window.devicePixelRatio || 1;
//   const canvasWidth = (this.canvas.width - this.fixedLeft * dpr) / dpr;
//   const pixelsPerStep = this.timeStepBaseWidth * this.zoomLevel;
//   const visibleSteps = canvasWidth / pixelsPerStep;
//   const maxOffset = this.data ? Math.max(0, this.data.length - visibleSteps) : 0;
  
//   this.viewOffset = Math.max(0, Math.min(maxOffset, this.viewOffset));
  
  this.render();
}




handleMouseMove(e) {
    // 获取精确的canvas相对位置
    const { x: cssX, y: cssY } = this.getCanvasRelativePosition(e);
    const dpr = window.devicePixelRatio || 1;
    const physX = cssX * dpr;
    const physY = cssY * dpr;

    if (this.isDragging) {
        // 获取当前鼠标位置的世界坐标
        const [currentWorldX, currentWorldY] = this.screenToWorld(cssX, cssY);
        
        // 计算世界坐标的差值（拖动距离）
        const worldDeltaX = this.dragStartWorldX - currentWorldX;
        
        // 应用差值到视图偏移
        const newViewOffset = this.startViewOffset + worldDeltaX;
       


        const {x0, x1} = this.getVisibleTimeStepRange();
        this.viewOffset = Math.max(0, newViewOffset);
        
        // 重新渲染
        this.render();
        return;
    }

    // 统一使用物理像素坐标
    const prevHovered = this.hoveredOperation;
    this.hoveredOperation = this.findOperationAt(physX, physY);
    this.updateTooltip(cssX, cssY); // 工具提示使用CSS像素
    //console.log('hoveredOperation =', this.hoveredOperation);

    if (prevHovered !== this.hoveredOperation) {
        this.render();
    }

    if (this.hoveredOperation) {
        this.onOperationHover(this.hoveredOperation);
    }
}

// 精确获取canvas相对位置
getCanvasRelativePosition(e) {
    const rect = this.canvas.getBoundingClientRect();
    const style = getComputedStyle(this.canvas);
    const borderLeft = parseInt(style.borderLeftWidth) || 0;
    const borderTop = parseInt(style.borderTopWidth) || 0;
    const scrollX = window.scrollX || window.pageXOffset;
    const scrollY = window.scrollY || window.pageYOffset;
    
    return {
        x: e.clientX + scrollX - rect.left - borderLeft,
        y: e.clientY + scrollY - rect.top - borderTop
    };
}


//   handleMouseDown(e) {
//     this.isDragging = true;
//     this.dragStartX = e.clientX;
//     this.startViewOffset = this.viewOffset;
//     e.preventDefault();
//   }
    handleMouseDown(e) {
        this.isDragging = true;
        this.dragStartX = e.clientX;
        this.startViewOffset = this.viewOffset;
        
        // 新增：记录开始拖动时的鼠标世界坐标
        const { x: cssX, y: cssY } = this.getCanvasRelativePosition(e);
        const [worldX, worldY] = this.screenToWorld(cssX, cssY);
        this.dragStartWorldX = worldX;
        
        e.preventDefault();
    }



  handleMouseUp() {
    this.isDragging = false;

  }

  handleMouseLeave() {
    this.isDragging = false;
    this.hoveredOperation = null;
    this.updateTooltip();
    this.render();
  }

//   handleClick(e) {
//     if (!this.data || !this.hoveredOperation) return;

//     this.selectedOperations.clear();
//     this.selectedOperations.add(this.hoveredOperation.id);

//     //console.log('handle click :', this.dependencies[this.hoveredOperation.op.id]);
//     console.log('handle click: ', this.hoveredOperation.op.id);

//     if (this.dependencies[this.hoveredOperation.op.id]) {
//       this.dependencies[this.hoveredOperation.op.id].forEach(dep => {
//         this.selectedOperations.add(dep.op.id);
//       });
//     }
    

//     this.onOperationSelect(this.hoveredOperation, this.selectedOperations);
//     console.log('handle click: selectedOperations =', this.selectedOperations);
//     this.render();
//   }


handleClick(e) {
  if (!this.data || !this.hoveredOperation) return;
  
  const clickedOpId = this.hoveredOperation.op.id;
  this.selectedOperations.clear();
  
  // 添加当前点击的操作
  this.selectedOperations.add(clickedOpId);
  
  // 添加所有下游依赖（当前操作依赖的操作）
  if (this.dependencies.downstream[clickedOpId]) {
    this.dependencies.downstream[clickedOpId].forEach(dep => {
      this.selectedOperations.add(dep.op.id);
    });
  }
  
  // 添加所有上游依赖（依赖当前操作的操作）
  if (this.dependencies.upstream[clickedOpId]) {
    this.dependencies.upstream[clickedOpId].forEach(src => {
      this.selectedOperations.add(src.op.id);
    });
  }
  
  // 添加依赖链中的同级操作（todo）
  //this.addPeerDependencies(clickedOpId);
  
  console.log(`Clicked operation: ${clickedOpId}`);
  console.log('Selected operations:', [...this.selectedOperations]);
  
  this.onOperationSelect(this.hoveredOperation, this.selectedOperations);
  this.render();
}

/**
 * 添加同级依赖关系（如compute操作的load/store对）
 * @param {string} opId - 操作ID
 */
addPeerDependencies(opId) {
  const op = this.findOperationById(opId);
  if (!op) return;
  
  // 对于compute操作，添加关联的load和store
  if (op.type === 'compute') {
    const loadOp = this.findOperationByProperties({
      type: 'loads',
      address: op.address,
      ts: op.ts - 1
    });
    
    const storeOp = this.findOperationByProperties({
      type: 'stores',
      address: op.address,
      ts: op.ts + 1
    });
    
    if (loadOp) this.selectedOperations.add(loadOp.id);
    if (storeOp) this.selectedOperations.add(storeOp.id);
  }
  
  // 对于load/store操作，添加关联的compute
  else if (op.type === 'loads' || op.type === 'stores') {
    const computeOp = this.findOperationByProperties({
      type: 'compute',
      address: op.address,
      ts: op.type === 'loads' ? op.ts + 1 : op.ts - 1
    });
    
    if (computeOp) this.selectedOperations.add(computeOp.id);
  }
}






/**
 * 精确的碰撞检测函数：在给定的CSS坐标处查找对应的操作
 * @param {number} physX - PHYS坐标X（相对于画布）
 * @param {number} physY - PHYS坐标Y（相对于画布）
 * @returns {Object|null} 操作信息对象（包含操作、类型和时间步）或null
 */
findOperationAt(physX, physY) {
  if (!this.data) return null;

  // 1. 将PHYS坐标转换为世界坐标
  const [worldX, worldY] = this.screenToWorld(physX, physY);

  // 2. 获取可见时间步范围（带缓冲区）
  const { startTs, endTs } = this.getVisibleTimeStepRange(2);
  
  // 3. 遍历可见时间步和操作类型
  for (let ts = startTs; ts <= endTs; ts++) {
    const timestep = this.data[ts];
    if (!timestep) continue;

    // 遍历三种操作类型（存储、计算、加载）
    for (const type of ['stores', 'compute', 'loads']) {
      if (!timestep[type] || !timestep[type].length) continue;
      
      // 4. 获取当前类型的泳道索引
      const laneIndex = this.lanes.findIndex(l => l.id === type);
      if (laneIndex === -1) continue;
      
      // 5. 计算泳道的世界坐标范围
      const laneHeight = this.RECT_COORDS.LANE_HEIGHT * this.RECT_COORDS.RECT_HEIGHT_RATIO ;
      const laneTop = this.RECT_COORDS.LANE_START_Y + laneIndex * this.RECT_COORDS.LANE_HEIGHT + laneHeight;
      const laneBottom = laneTop + laneHeight;
      const dpr = window.devicePixelRatio || 1;
      
      // 6. 检查Y坐标是否在当前泳道范围内
      if (worldY*dpr < laneTop || worldY*dpr > laneBottom) continue;
      
      // 7. 计算每个操作的宽度（均分时间步宽度）
      const opCount = timestep[type].length;
      const opWidth = 1.0 / opCount;
      
      // 8. 遍历当前类型的所有操作
      for (let opIndex = 0; opIndex < opCount; opIndex++) {
        const op = timestep[type][opIndex];
        
        // 9. 计算操作的世界坐标范围
        const opX = ts + opIndex * opWidth;
        const opXEnd = opX + opWidth;
        
        // 10. 检查X坐标是否在当前操作范围内
        if (worldX >= opX && worldX <= opXEnd) {
          return { op, type, ts };
        }
      }
    }
  }
  
  return null; // 未找到任何操作
}



  calculateStepInterval(totalSteps) {
    const visibleWidth = this.canvas.width - 100;
    const minLabelWidth = 80;
    const idealInterval = Math.ceil(minLabelWidth / (this.timeStepBaseWidth * this.zoomLevel));
    
    if (idealInterval < 1) return 1;
    if (idealInterval > 10) {
      return 10 * Math.ceil(idealInterval / 10);
    }
    return idealInterval;
  }

  findOperationById(opId) {
    if (!this.data) return null;

    for (let ts = 0; ts < this.data.length; ts++) {
      const timestep = this.data[ts];
      
      for (const type of   [ 'stores','compute', 'loads']) {
        if (timestep[type]) {
          const op = timestep[type].find(op => op.id === opId);
          if (op) return { op, type, ts };
        }
      }
    }
    
    return null;
  }

  updateTooltip(x, y) {
    if (!this.tooltipElement) return;

    if (this.hoveredOperation) {
      const op = this.hoveredOperation.op;
      const type = this.hoveredOperation.type;

      this.tooltipElement.innerHTML = `
        <div class="tooltip-title">Op</div>
        <div><span>ID:</span> ${op.id}</div>
        <div><span>Operation:</span> ${op.operation || 'N/A'}</div>
        <div><span>Type:</span> ${type}</div>
        <div><span>TS:</span> ${this.hoveredOperation.ts}</div>
        <div><span>Duration:</span> ${Math.max(1, op.hold_in_lmem || 0)} time steps</div>
        <div><span>Target:</span> ${op.target || 'N/A'}</div>
      `;

      this.tooltipElement.style.left = `${x + 15}px`;
      this.tooltipElement.style.top = `${y + 15}px`;
      this.tooltipElement.classList.add('show');
    } else {
      this.tooltipElement.classList.remove('show');
    }
  }

  lightenColor(color, percent) {
    return [
      Math.min(1, color[0] + percent),
      Math.min(1, color[1] + percent),
      Math.min(1, color[2] + percent),
      color[3]
    ];
  }

  zoomIn() {
    this.zoomLevel = Math.min(this.maxZoom, this.zoomLevel + 0.2);
    this.render();
  }

  zoomOut() {
    this.zoomLevel = Math.max(this.minZoom, this.zoomLevel - 0.2);
    this.render();
  }

  resetZoom() {
    this.zoomLevel = 1.0;
    this.viewOffset = 0;
    this.render();
  }

  destroy() {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
    }

    if (this.gl) {
      this.gl.deleteProgram(this.program);
      this.gl.deleteProgram(this.overlayProgram);
      Object.values(this.buffers).forEach(buffer => this.gl.deleteBuffer(buffer));
      this.gl.deleteTexture(this.overlayTexture);
    }

    this.canvas.removeEventListener('wheel', this.handleWheel);
    this.canvas.removeEventListener('mousemove', this.handleMouseMove);
    this.canvas.removeEventListener('mousedown', this.handleMouseDown);
    this.canvas.removeEventListener('mouseup', this.handleMouseUp);
    this.canvas.removeEventListener('mouseleave', this.handleMouseLeave);
    this.canvas.removeEventListener('click', this.handleClick);
    window.removeEventListener('resize', this.resize);
  }

  logPoint(label, worldX, worldY) {
  const dpr = window.devicePixelRatio || 1;
  const [px, py] = this.worldToPhysical(worldX, worldY);
  console.log(`${label} | world(${worldX}, ${worldY}) -> phys(${px.toFixed(1)}, ${py.toFixed(1)})`);
}


worldToPhysical(x, y) {
  const dpr = window.devicePixelRatio || 1;
  const [screenX, screenY] = this.worldToScreen(x, y); // 已经乘了 dpr
  return [screenX, screenY];
}

getVisibleTimeStepRange(buffer = 1) {
  const dpr = window.devicePixelRatio || 1;
  const fixedLeft = this.fixedLeft;
  
  if (!this.data) return { startTs: 0, endTs: 0 };
  
  const visibleWorldWidth = (this.canvas.width - fixedLeft * dpr) / 
                          (this.timeStepBaseWidth * this.zoomLevel * dpr);
  
  // 添加缓冲区域
  const startTs = Math.max(0, Math.floor(this.viewOffset - buffer));
  const endTs = Math.min(this.data.length - 1, 
                       Math.ceil(this.viewOffset + visibleWorldWidth + buffer));

  
  return { startTs, endTs };
}

debugCoordinateSystems() {
  console.log('坐标系调试:');
  console.log('- Y轴屏幕位置:', this.fixedLeft);
  console.log('- 时间步0世界坐标: (0, 0)');
  console.log('- 时间步0屏幕坐标:', this.worldToScreen(0, 0));
  console.log('- 视图偏移 viewOffset:', this.viewOffset);
  console.log('- 画布宽度:', this.canvas.width);
}

}
