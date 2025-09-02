import { mat4, vec2, vec4 } from 'gl-matrix';
import { ShaderLoader } from '../shader-loader.js';
import { Canvas2DRenderer } from './canvas2d-renderer.js';
import { CoordinateUtils } from '@/utils/coordinate-utils.js';

// *** NEW *** 引入颜色工具（假设您有或需要创建）
// import { getTab20Color } from '../../utils/color-utils.js';
// 临时实现一个简单的tab20色系
function getTab20Color(index, alpha = 1) {
    const tab20 = [
        [0.12156862745098039, 0.4666666666666667, 0.7058823529411765, alpha],    // Blue
        [0.6823529411764706, 0.7803921568627451, 0.9098039215686274, alpha],     // Light Blue
        [0.17254901960784313, 0.6274509803921569, 0.17254901960784313, alpha],   // Green
        [0.596078431372549, 0.8745098039215686, 0.5411764705882353, alpha],      // Light Green
        [0.8392156862745098, 0.15294117647058825, 0.1568627450980392, alpha],    // Red
        [1.0, 0.596078431372549, 0.5882352941176471, alpha],                     // Light Red
        [0.5803921568627451, 0.403921568627451, 0.7411764705882353, alpha],      // Purple
        [0.7725490196078432, 0.6901960784313725, 0.8352941176470589, alpha],     // Light Purple
        [0.5490196078431373, 0.33725490196078434, 0.29411764705882354, alpha],   // Brown
        [0.7686274509803922, 0.611764705882353, 0.5803921568627451, alpha],      // Light Brown
        [0.8901960784313725, 0.4666666666666667, 0.7607843137254902, alpha],     // Pink
        [0.9686274509803922, 0.7137254901960784, 0.8235294117647058, alpha],     // Light Pink
        [0.4980392156862745, 0.4980392156862745, 0.4980392156862745, alpha],     // Gray
        [0.7803921568627451, 0.7803921568627451, 0.7803921568627451, alpha],     // Light Gray
        [0.7372549019607844, 0.7411764705882353, 0.13333333333333333, alpha],    // Olive
        [0.8588235294117647, 0.8588235294117647, 0.5529411764705883, alpha],     // Light Olive
        [0.09019607843137255, 0.7450980392156863, 0.8117647058823529, alpha],    // Cyan
        [0.6196078431372549, 0.8549019607843137, 0.8980392156862745, alpha],     // Light Cyan
        [0.6941176470588235, 0.34901960784313724, 0.1568627450980392, alpha],    // Orange
        [0.9372549019607843, 0.5411764705882353, 0.3843137254901961, alpha]      // Light Orange
    ];
    return tab20[index % tab20.length];
}

export class LmemRenderer {
    constructor(canvas, options = {}) {
        this.canvas = typeof canvas === 'string' ?
            document.querySelector(canvas) : canvas;
        if (!this.canvas) {
            throw new Error('[LmemRenderer] canvas not found');
        }
        
        // 初始化2D渲染器，配置事件代理
        this.canvas2d = new Canvas2DRenderer(this.canvas, {
            zIndex: 10,
            pointerEvents: 'none', // 默认不拦截事件
            className: 'letsvis-axis-overlay',
            eventProxy: true // 启用事件代理 ????
        });

        this.gl =
            this.canvas.getContext('webgl2', { antialias: false, premultipliedAlpha: false })
            ||
            this.canvas.getContext('webgl', { antialias: false, premultipliedAlpha: false }); // *** MODIFIED *** 关闭抗锯齿，线条更清晰
        if (!this.gl) {
          console.error('WebGL not supported or canvas not available');
          console.error('Canvas:', this.canvas);
          console.error('Canvas client dimensions:', this.canvas.clientWidth, this.canvas.clientHeight);
          throw new Error('[LmemRenderer] WebGL not supported');
      }

        this.tooltipElement = options.tooltipElement || null;
        this.chipSpec = null;

        // 4. 内部状态
        this.programs = {};
        this.buffers = {};
        this.textures = {};
        this.viewMatrix = mat4.create();
        this.hoveredBlock = null;
        this.selectedBlocks = new Set();
        this.lastData = null;
        this.gridVertxCount = null;
        this.viewRange = {};

        // 事件中心
        this.eventListeners = {};

        // *** NEW *** 用于存储每个块的唯一颜色索引
        this.blockColorIndexMap = new Map();
        this.nextColorIndex = 0;

        // 6. 延迟初始化，让调用者有机会再调用
        this.initialized = false;

        // *** NEW *** 绑定事件处理函数的this上下文
        this.mouseMoveHandler = this.onMouseMove.bind(this);
        this.clickHandler = this.onClick.bind(this);

        // 缩放状态管理
        this.zoomScale= 1.0;
        this.zoomCenter = vec2.fromValues(0, 0);
        this.baseMinInteractWidth = 0.1; // 基础最小宽度
        this.zoomHandler = null; 
    }

    /* -------------------- 生命周期 -------------------- */
    async init() {
        if (this.initialized) return;

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
                    this.calculateViewMatrix(this.lastData); // *** MODIFIED *** 调整大小时重新计算矩阵
                    this.render(this.lastData); // 重绘
                }
            }
        };
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);

        await this.initShaders();
        this.initBuffers();
        this.initEventHandlers();
        this.initialized = true;
    }

    destroy() {
        // 释放 WebGL 资源
        Object.values(this.programs).forEach(p => this.gl.deleteProgram(p));
        Object.values(this.buffers).forEach(bufMap =>
            Object.values(bufMap).forEach(b => this.gl.deleteBuffer(b))
        );
        Object.values(this.textures).forEach(t => this.gl.deleteTexture(t));

        this.canvas2d.destroy();

        // 移除事件
        this.canvas.removeEventListener('mousemove', this.mouseMoveHandler);
        this.canvas.removeEventListener('click', this.clickHandler);
        window.removeEventListener('resize', this.resizeCanvas);


        // 销毁 2D 渲染器
        this.canvas2d.destroy();
       

        this.eventListeners = {};
        this.initialized = false;
    }

    /* -------------------- 事件系统 -------------------- */
    on(event, callback) {
        (this.eventListeners[event] ||= []).push(callback);
    }

    emit(event, ...args) {
        (this.eventListeners[event] || []).forEach(fn => fn(...args));
    }


    // *** MODIFIED *** 颜色映射（使用tab20色系，按操作类型分配）
    getColorForBlock(block) {
        // 为不同的操作类型分配不同的颜色基索引
        let baseIndex = 0;
        if (block.lmem_type === 'LMEM_WEIGHT') baseIndex = 4;
        if (block.lmem_type === 'LMEM_OPERATION') baseIndex = 8;

        // 为每个唯一的op_name分配一个颜色索引
        if (!this.blockColorIndexMap.has(block.op_name)) {
            this.blockColorIndexMap.set(block.op_name, this.nextColorIndex);
            this.nextColorIndex++;
        }
        const colorIndex = baseIndex + this.blockColorIndexMap.get(block.op_name);

        // 获取基础颜色
        const baseColor = getTab20Color(colorIndex, 0.7); // 70% 透明度

        // 如果分配失败，叠加红色色调
        if (block.status === 'failed') {
            return [
                Math.min(1.0, baseColor[0] * 0.8 + 0.5), // 减少原始色，增加红色
                baseColor[1] * 0.4,
                baseColor[2] * 0.4,
                baseColor[3]
            ];
        }

        return baseColor;
    }


    // 在initShaders方法中加载网格着色器和主着色器
    async initShaders() {
        try {
            console.log('开始加载着色器...');
            
            // 加载主着色器和网格着色器
            const [mainShaders, gridShaders] = await Promise.all([
                ShaderLoader.load(this.gl, 'memory'),
                ShaderLoader.load(this.gl, 'grid')
            ]);
            
            console.log('着色器文件加载完成');

            // 编译着色器程序
            this.programs = {
                main: ShaderLoader.compile(this.gl, mainShaders.vert, mainShaders.frag),
                grid: ShaderLoader.compile(this.gl, gridShaders.vert, gridShaders.frag)
            };

            // 检查着色器编译状态
            if (!this.programs.main || !this.programs.grid) {
                throw new Error('着色器编译失败');
            }

            // 检查主着色器链接状态
            const mainLinkStatus = this.gl.getProgramParameter(this.programs.main, this.gl.LINK_STATUS);
            if (!mainLinkStatus) {
                const error = this.gl.getProgramInfoLog(this.programs.main);
                throw new Error('主着色器链接失败: ' + error);
            }
            
            // 检查网格着色器链接状态
            const gridLinkStatus = this.gl.getProgramParameter(this.programs.grid, this.gl.LINK_STATUS);
            if (!gridLinkStatus) {
                const error = this.gl.getProgramInfoLog(this.programs.grid);
                throw new Error('网格着色器链接失败: ' + error);
            }

            console.log('着色器编译成功');
            
        } catch (error) {
            console.error('着色器初始化失败:', error);
            throw error;
        }
    }

    initBuffers() {
      const gl = this.gl;
        this.buffers = {
            blocks: {
                position: this.createBuffer(),   // 矩形左下角坐标 (x, y)
                size: this.createBuffer(),       // 矩形尺寸 (width, height)
                color: this.createBuffer(),      // 矩形颜色 (r, g, b, a)
                type: this.createBuffer(),       // 图案类型 (0: 无, 1: 斜线, 2: 星号)
                border: this.createBuffer(),      // 边框类型 (0: 黑, 1: 红)
                unitCoord: this.createBuffer()   // 单位坐标缓冲区
            },
            grid:{
                position: this.createBuffer(),  // 网格顶点
                width: this.createBuffer(), // 线宽
                type: this.createBuffer() // 线类型
            },
            // *** NEW *** 用于绘制矩形的顶点索引缓冲区
            quad: this.createBuffer()
        };

        // 初始化单位坐标数据（每个矩形的6个顶点对应的UV坐标）
        const unitCoords = new Float32Array([
            0.0, 0.0, // 左下 - 第一个三角形
            1.0, 0.0, // 右下
            0.0, 1.0, // 左上
            
            1.0, 0.0, // 右下 - 第二个三角形  
            1.0, 1.0, // 右上
            0.0, 1.0  // 左上
        ]);
        
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.blocks.unitCoord);
        gl.bufferData(gl.ARRAY_BUFFER, unitCoords, gl.STATIC_DRAW);

        //console.log('Unit coords:', Array.from(unitCoords));


        // 初始化一个单位矩形（两个三角形）的索引数据
        const quadIndices = new Uint16Array([
            0,1,2,
            3,4,5
        ]);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.buffers.quad);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, quadIndices, gl.STATIC_DRAW);

        // 检查缓冲区大小
        const bufferSizes = gl.getBufferParameter(gl.ELEMENT_ARRAY_BUFFER, gl.BUFFER_SIZE);
        console.log('Quad index buffer size:', bufferSizes, 'bytes', bufferSizes / 2, 'indices' );
    }

    createBuffer() {
        const buffer = this.gl.createBuffer();
        if (!buffer) throw new Error('Failed to create WebGL buffer');
        return buffer;
    }

    // *** MODIFIED *** 核心渲染函数
    render(data, isZoomRender = false) {
        if (!data) {
            console.warn('Render called with null data');
            return;
        }

        try {
            this.lastData = data;
            console.log('=== RENDER START ===');
            // console.log('Data received:', data);
            // console.log('Allocations count:', data.allocations?.length);

            // if (data.allocations && data.allocations.length > 0) {
            //     console.log('First allocation:', data.allocations[0]);
            // }

            // 确保canvas物理尺寸正确
            const dpr = window.devicePixelRatio || 1;
            const displayWidth = Math.floor(this.canvas.clientWidth * dpr);
            const displayHeight = Math.floor(this.canvas.clientHeight * dpr);
            
            // 跟随矩阵同步更新视图
            this.updateViewRangeFromMatrix();

            if (!this.viewRange || !isZoomRender) {
                this.calculateViewMatrix(data);   // 只有第一次或数据变化时才算
            }
            // console.log('当前视图矩阵viewMatrix:', this.viewMatrix);

            // 2. 上传数据到GPU
            this.uploadMemoryBuffers(data);

            // 3. 设置视口和清除画布
            this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
            this.gl.clearColor(0.98, 0.98, 0.98, 1.0);
            this.gl.disable(this.gl.DEPTH_TEST); // 禁用深度测试
            this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
            // 启用混合
            this.gl.enable(this.gl.BLEND);
            this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA); 

            // 4. 绘制顺序
            this.drawGrid(data); // 绘制网格
            this.drawMemoryBlocks(data.allocations);

            this.drawAxisLabels(data); // 绘制坐标信息
            //this.axisRenderer.render(this.worldToScreen.bind(this), this.viewRange);

            console.log('=== RENDER END ===');
             
        } catch (error) {
            console.error('Render failed:', error);
        }
    }

    // *** NEW *** 计算视图矩阵
    calculateViewMatrix(data) {
        if (!data || !data.allocations || data.allocations.length === 0) {
            this.viewMatrix = mat4.create();
            return;
        }

        const allocations = data.allocations;
        const settings = data.settings || {};

        // 计算数据范围 - X轴基于时间步编号，Y轴基于内存地址
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;

        allocations.forEach(alloc => {
            const duration = alloc.timestep_end - alloc.timestep_start;
            const centerX = (alloc.timestep_start + alloc.timestep_end) / 2;
            const width = duration + 1;
            
            const x1 = centerX - width / 2;
            const x2 = centerX + width / 2;
            const y1 = alloc.addr;
            const y2 = alloc.addr + alloc.size;

            minX = Math.min(minX, x1);
            maxX = Math.max(maxX, x2);
            minY = Math.min(minY, y1);
            maxY = Math.max(maxY, y2);
        });

        // 使用芯片规格如果可用
        if (settings.lmem_bytes) {
            maxY = Math.max(maxY, settings.lmem_bytes);
        }

        // 确保至少有一个时间步的宽度
        if (maxX <= minX) {
            maxX = minX + 1;
        }

        //console.log('数据范围:', { minX, maxX, minY, maxY });

        // 添加10%的边距
        const xRange = maxX - minX;
        const yRange = maxY - minY;
        const xMargin = xRange * 0.1;
        const yMargin = yRange * 0.1;

        // const left = minX - xMargin;
        // const right = maxX + xMargin;
        // const bottom = minY - yMargin;
        // const top = maxY + yMargin;

        let left = minX - xMargin;
        let right = maxX + xMargin;
        let bottom = minY - yMargin;
        let top = maxY + yMargin;

        //console.log('视图范围:', { left, right, bottom, top });
        this.viewRange = { left, right, bottom, top };

        mat4.ortho(this.viewMatrix, left, right, bottom, top, -1, 1);

        console.log('计算得视图矩阵viewMatrix:', this.viewMatrix);
    }

    drawMemoryBlocks(allocations) {
        if (!allocations || allocations.length === 0) return;

        const gl = this.gl;
        gl.useProgram(this.programs.main);

        // 设置uniform
        const uView = gl.getUniformLocation(this.programs.main, 'uViewMatrix');
        if (uView) {
            gl.uniformMatrix4fv(uView, false, this.viewMatrix);
        }

        // *** NEW *** 传递屏幕尺寸
        const uScreenSize = gl.getUniformLocation(this.programs.main, 'uScreenSize');
        if (uScreenSize) {
            gl.uniform2f(uScreenSize, gl.canvas.width, gl.canvas.height);
        }

        // 设置属性
        this.setupMainShaderAttributes();

        // 绘制所有三角形（每个矩形6个顶点）
        const vertexCount = this.validAllocationsCount * 6; // 使用修复后的计数
        //console.log('绘制调用: TRIANGLES, 顶点数:', vertexCount, '矩形数:', this.validAllocationsCount);
        gl.drawArrays(gl.TRIANGLES, 0, vertexCount);

        this.disableMainAttributes();
    }


    // 图案类型映射
    getPatternType(lmemType) {
        const patternMap = {
            LMEM_ACTIVATION: 0.0,  // 无图案（空白）
            LMEM_WEIGHT: 1.0,      // 斜线
            LMEM_OPERATION: 2.0,   // 星号
            default: 0.0
        };
        return patternMap[lmemType] || patternMap.default;
    }

    // // *** MODIFIED *** 绘制网格

    // 计算网格数据
    generateGridData(data) {
        const { settings, allocations } = data;
        const { bankSize, maxMemory, bankNum } = this.calculateDimensions(settings);
        const totalTimesteps = this.calculateTotalTimesteps(allocations);
        
        const gridVertices = [];
        const lineWidths = [];
        const lineTypes = [];
        
        // 1. 垂直网格线（时间步）
        for (let ts = 0; ts <= totalTimesteps; ts++) {
            gridVertices.push(ts-0.5, 0, ts-0.5, maxMemory);
            lineWidths.push(0.5, 0.5);
            lineTypes.push(0.0, 0.0)
        }
        
        // 2. 水平网格线（Bank分隔线）
        for (let bank = 0; bank <= bankNum; bank++) {
            const y = bank * bankSize;
            gridVertices.push(-0.5, y, totalTimesteps-0.5, y);
            lineWidths.push(0.5, 0.5);
            lineTypes.push(1.0, 1.0)
        }

        
        // 3. 最大内存线（红色）
        gridVertices.push(-0.5, data.settings?.lmem_bytes, totalTimesteps-0.5, data.settings?.lmem_bytes);
        lineWidths.push(0.3, 0.3);
        lineTypes.push(2.0, 2.0)
        
        return {
            vertices: new Float32Array(gridVertices),
            //positions: new Float32Array(gridVertices),
            widths: new Float32Array(lineWidths),
            types: new Float32Array(lineTypes),
            vertexCount: gridVertices.length / 2
        };
    }

    
    drawGrid(data) {
        console.log('=== drawGrid 开始 ===');
        if (!data) {
            console.warn('drawGrid: data 为空');
            return;
        }
        if (!this.programs.grid) {
            console.warn('drawGrid: grid program 未初始化');
            return;
        }
        
        const gl = this.gl;
        const gridData = this.generateGridData(data);

        console.log('buffer:',{
            vertices : gridData.vertices,
            widths : gridData.widths,
            types : gridData.types
        })
        
        // 上传网格数据
        this.uploadGridBuffer(gridData);
        
        // 绘制着色器程序设置
        gl.useProgram(this.programs.grid);
        
        // 设置uniform
        const uView = gl.getUniformLocation(this.programs.grid, 'uViewMatrix');
        const uScreenSize = gl.getUniformLocation(this.programs.grid, 'uScreenSize');
        
        if (uView) gl.uniformMatrix4fv(uView, false, this.viewMatrix);
        if (uScreenSize) gl.uniform2f(uScreenSize, gl.canvas.width, gl.canvas.height);
        
        // 设置属性
        this.setupGridShaderAttributes();

        gl.enable(gl.BLEND);
        // 绘制网格线
        gl.drawArrays(gl.LINES, 0, gridData.vertexCount);
        // // 禁用混合
        // gl.disable(gl.BLEND);
        
        // 清理
        this.disableGridAttributes();
    }



    /* -------------------- 交互 -------------------- */
    initEventHandlers() {
        this.canvas.addEventListener('mousemove', this.mouseMoveHandler);
        this.canvas.addEventListener('click', this.clickHandler);
    }


    onMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        // 直接用 CSS 像素
        const pos = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
        const world = this.screenToWorld(pos);
        const block = this.findBlockAtPosition(world);


        this.hoveredBlock = block;
        this.lastMousePos = pos;   // 这里也存 CSS 像素
        this.handleHover(block);
        this.render(this.lastData, true);
    }

    onClick(e) {
        if (this.hoveredBlock) this.toggleSelection(this.hoveredBlock);
    }

    toggleSelection(block) {
        const id = this.getBlockId(block);
        if (this.selectedBlocks.has(id)) {
            this.selectedBlocks.delete(id);
        } else {
            this.selectedBlocks.add(id);
        }
        this.emit('blockSelect', block, this.selectedBlocks);
        this.render(this.lastData, false);
    }

    // *** NEW *** 生成块的唯一ID
    getBlockId(block) {
        return `${block.op_name}_${block.timestep_start}_${block.addr}`;
    }

    handleHover(block) {
        // 1. 更新 tooltip
        if (this.tooltipElement) {
            if (block) {
                this.tooltipElement.innerHTML = this.createTooltipContent(block);
                this.tooltipElement.classList.add('show');
                const rect = this.canvas.getBoundingClientRect();
                const dpr = window.devicePixelRatio || 1;
                this.tooltipElement.style.left = `${(this.lastMousePos.x / dpr) + rect.left + 15}px`;
                this.tooltipElement.style.top = `${(this.lastMousePos.y / dpr) + rect.top + 15}px`;
            } else {
                this.tooltipElement.classList.remove('show');
            }
        }
        // 2. 事件总线
        this.emit('blockHover', block);
    }

    // *** MODIFIED *** 高亮绘制（也使用TRIANGLES）
    drawHighlights() {
        const gl = this.gl;
        if (!this.lastData?.allocations) return;


    }

    /* -------------------- 工具函数 -------------------- */
    calculateDimensions(settings) {
        return {
            bankSize: settings?.lmem_bank_bytes || 65536, 
            maxMemory: settings?.lmem_bytes || (1024 * 1024),
            bankNum:  settings?.lmem_banks || Math.ceil(maxMemory / bankSize)
        };
    }

    uploadBufferData(name, data, isGrid = false) {
        const gl = this.gl;
        const buffer = isGrid ? this.buffers.grid[name] : this.buffers.blocks[name];

        if(!buffer) {
            console.error(`[LmemRenderer] Buffer ${name} not found`);
            return;
        }
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
        //console.log(`[LmemRenderer] Uploaded ${data.length / 2} vertices to buffer ${name}`);
    }



    // 屏幕坐标到世界坐标的转换
    screenToWorld({ x, y }) {
        return CoordinateUtils.screenToWorld({ x, y }, this.viewRange, this.canvas);
    }

    // 世界坐标到屏幕坐标的转换方法
    worldToScreen([worldX, worldY]) {
        return CoordinateUtils.worldToScreen([worldX, worldY], this.viewRange, this.canvas);
    }

    // WebGL坐标到屏幕坐标的转换
    webglToScreen([x, y]) {
        return CoordinateUtils.webglToScreen(this.viewMatrix, [x, y], this.canvas);
    }

    // 内存大小格式化工具
    formatMemorySize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }

    // *** MODIFIED *** 查找块（使用矩形边界检查）
    findBlockAtPosition(worldPos) {
        if (!this.lastData) return null;
        const [x, y] = worldPos;

        const totalTimesteps = this.calculateTotalTimesteps(this.lastData.allocations);
        
        // 动态计算最小交互宽度：缩放级别越高，交互精度越高
        const dynamicMinWidth = this.baseMinInteractWidth / this.zoomScale;
        //console.log('zoomScale in renderer:', this.zoomScale)

        for (let i = this.lastData.allocations.length - 1; i >= 0; i--) {
            const a = this.lastData.allocations[i];
            const s = a.timestep_start;
            const e = a.timestep_end;
            
            let left, right;
            
            // 处理正常时间范围
            if (s <= e) {
                const duration = e - s;
                const centerX = (s + e) / 2;
                const visualWidth = duration + 1;
                
                // 使用动态交互宽度
                const interactWidth = Math.max(visualWidth, dynamicMinWidth);
                
                left = centerX - interactWidth / 2;
                right = centerX + interactWidth / 2;
            }
            // 处理循环时间范围
            else {
                const duration1 = totalTimesteps - s;
                const centerX1 = (s + totalTimesteps - 1) / 2;
                const visualWidth1 = duration1;
                const interactWidth1 = Math.max(visualWidth1, dynamicMinWidth);
                
                left = centerX1 - interactWidth1 / 2;
                right = centerX1 + interactWidth1 / 2;
                
                // 检查第一部分
                const inX1 = x >= left && x <= right;
                const inY1 = y >= a.addr && y <= a.addr + a.size;
                
                if (inX1 && inY1) {
                    return a;
                }
                
                // 检查第二部分
                const duration2 = e + 1;
                const centerX2 = e / 2;
                const visualWidth2 = duration2;
                const interactWidth2 = Math.max(visualWidth2, dynamicMinWidth);
                
                left = centerX2 - interactWidth2 / 2;
                right = centerX2 + interactWidth2 / 2;
            }

            const inX = x >= left && x <= right;
            const inY = y >= a.addr && y <= a.addr + a.size;
            
            if (inX && inY) {
                return a;
            }
        }
        return null;
    }

    // *** MODIFIED *** 创建更详细的Tooltip
    createTooltipContent(block) {
        const sizeKB = block.size / 1024;
        return `
            <div class="tooltip-title">${block.op_name}</div>
            <div><span>Block ID:</span> ${block.id || 'N/A'}</div>
            <div><span>Timestep:</span> ${block.timestep_start} → ${block.timestep_end}</div>
            <div><span>Address:</span> 0x${block.addr.toString(16)} - 0x${(block.addr + block.size).toString(16)}</div>
            <div><span>Size:</span> ${block.size}B (${sizeKB.toFixed(1)} KB)</div>
            <div><span>Op Type:</span> ${block.op_type || 'N/A'}</div>
            <div><span>LMEM Type:</span> ${block.lmem_type}</div>
            <div><span>Status:</span> <span style="color: ${block.status === 'success' ? 'green' : 'red'}">${block.status}</span></div>
        `;
    }

    /* -------------------- attribute / uniform 绑定工具 -------------------- */
    /**
     * 启用或禁用着色器属性
     * @param {WebGLProgram} program - 着色器程序
     * @param {Object} attributeConfig - 属性配置 { attributeName: buffer }
     * @param {boolean} enable - true启用, false禁用
     */
    manageShaderAttributes(program, attributeConfig, enable = true) {
        const gl = this.gl;
        
        for (const [attributeName, buffer] of Object.entries(attributeConfig)) {
            const location = gl.getAttribLocation(program, attributeName);
            
            if (location === -1) {
                console.warn(`Attribute ${attributeName} not found in shader`);
                continue;
            }
            
            if (enable) {
                gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
                gl.enableVertexAttribArray(location);
                
                // 根据属性名称确定数据类型和大小
                let size, type;
                if (attributeName === 'aPosition') {
                    size = 2; // vec2
                    type = gl.FLOAT;
                } else if (attributeName === 'aColor') {
                    size = 4; // vec4
                    type = gl.FLOAT;
                } else if (attributeName === 'aSize') {
                    size = 2; // vec2
                    type = gl.FLOAT;
                } else if (attributeName === 'aLineWidth' || attributeName === 'aType' || 
                        attributeName === 'aBorder' || attributeName === 'aLineType') {
                    size = 1; // float
                    type = gl.FLOAT;
                } else if (attributeName === 'aUnitCoord') {
                    size = 2; // vec2
                    type = gl.FLOAT;
                } else {
                    console.warn(`Unknown attribute type: ${attributeName}`);
                    continue;
                }
                
                gl.vertexAttribPointer(location, size, type, false, 0, 0);
            } else {
                gl.disableVertexAttribArray(location);
            }
        }
    }

    setupMainShaderAttributes() {
        const gl = this.gl;
        const prog = this.programs.main;

        if (!prog) {
            throw new Error('[LmemRenderer] main program not initialized');
        }

        const attributeConfig = {
            'aPosition': this.buffers.blocks.position,
            'aSize': this.buffers.blocks.size,
            'aColor': this.buffers.blocks.color,
            'aType': this.buffers.blocks.type,
            'aBorder': this.buffers.blocks.border,
            'aUnitCoord': this.buffers.blocks.unitCoord
        };

        this.manageShaderAttributes(prog, attributeConfig, true);
    }

    disableMainAttributes() {
        const gl = this.gl;
        const prog = this.programs.main;

        if (!prog) return;

        const attributeConfig = {
            'aPosition': null,
            'aSize': null,
            'aColor': null,
            'aType': null,
            'aBorder': null,
            'aUnitCoord': null
        };

        this.manageShaderAttributes(prog, attributeConfig, false);
    }

    setupGridShaderAttributes() {
        const gl = this.gl;
        const prog = this.programs.grid;

        if (!prog) {
            throw new Error('[LmemRenderer] grid program not initialized');
        }

        const attributeConfig = {
            'aPosition': this.buffers.grid.position,
            'aLineWidth': this.buffers.grid.width,
            'aLineType': this.buffers.grid.type
        };

        this.manageShaderAttributes(prog, attributeConfig, true);
    }


    disableGridAttributes() {
        const gl = this.gl;
        const prog = this.programs.grid;

        if (!prog) return;

        const attributeConfig = {
            'aPosition': null,
            'aLineWidth': null,
            'aLineType': null
        };

        this.manageShaderAttributes(prog, attributeConfig, false);
    }

    // *** MODIFIED *** 上传内存块数据
    uploadMemoryBuffers(data) {
        if (!data || !data.allocations) return;

        const gl = this.gl;
        const allocations = data.allocations;
        
        // 获取总时间步数（从数据中计算或使用设置）
        const totalTimesteps = this.calculateTotalTimesteps(allocations);
        console.log('总时间步数:', totalTimesteps);

        // 过滤无效数据
        const validAllocations = allocations.filter(alloc => {
            const s = alloc.timestep_start;
            const e = alloc.timestep_end;
            const isValid = (s >= 0 && e >= 0 && alloc.size > 0) && 
                          (s <= e || (s > e && totalTimesteps > 0));
            if (!isValid) {
                console.warn('跳过无效的内存块:', alloc);
            }
            return isValid;
        });

        console.log(`原始分配数: ${allocations.length}, 有效分配数: ${validAllocations.length}`);

        const positions = [];
        const colors = [];
        const types = [];
        const borders = [];
        const unitCoords = [];

        console.log('=== 顶点坐标调试 (包含循环时间步) ===');
        
        validAllocations.forEach((alloc, index) => {
            const color = this.getColorForBlock(alloc);
            const type = this.getPatternType(alloc.lmem_type);
            const border = alloc.status === 'failed' ? 1.0 : 0.0;

            const s = alloc.timestep_start;
            const e = alloc.timestep_end;
            const y1 = alloc.addr;
            const y2 = alloc.addr + alloc.size;

            // 处理正常时间范围 (s <= e)
            if (s <= e) {
                const duration = e - s;
                const centerX = (s + e) / 2;
                const width = duration + 1;
                
                const x1 = centerX - width / 2;
                const x2 = centerX + width / 2;

                // if (index < 3) {
                //     console.log(`正常范围 ${index}: [${s}, ${e}] => 中心${centerX}, 宽度${width}`);
                // }

                this.addRectangleVertices(positions, colors, types, borders, unitCoords,
                                        x1, y1, x2, y2, color, type, border);
            }
            // 处理循环时间范围 (s > e)
            else {
                // 第一部分: 从s到最大时间步
                const duration1 = totalTimesteps - s;
                const centerX1 = (s + totalTimesteps - 1) / 2;
                const width1 = duration1;
                
                const x1_1 = centerX1 - width1 / 2;
                const x2_1 = centerX1 + width1 / 2;

                // 第二部分: 从0到e
                const duration2 = e + 1;
                const centerX2 = e / 2;
                const width2 = duration2;
                
                const x1_2 = centerX2 - width2 / 2;
                const x2_2 = centerX2 + width2 / 2;
                // if (index < 3) {
                //     console.log(`循环范围 ${index}: [${s}, ${totalTimesteps-1}] + [0, ${e}]`);
                //     console.log(`  第一部分: 中心${centerX1}, 宽度${width1}`);
                //     console.log(`  第二部分: 中心${centerX2}, 宽度${width2}`);
                // }


                // 添加第一部分矩形
                this.addRectangleVertices(positions, colors, types, borders, unitCoords,
                                        x1_1, y1, x2_1, y2, color, type, border);
                
                // 添加第二部分矩形
                this.addRectangleVertices(positions, colors, types, borders, unitCoords,
                                        x1_2, y1, x2_2, y2, color, type, border);
            }
        });

        // 上传数据
        this.uploadBufferData('position', new Float32Array(positions));
        this.uploadBufferData('color', new Float32Array(colors));
        this.uploadBufferData('type', new Float32Array(types));
        this.uploadBufferData('border', new Float32Array(borders));
        this.uploadBufferData('unitCoord', new Float32Array(unitCoords));
        
        //console.log(`上传了 ${positions.length / 12} 个矩形段，${positions.length / 2} 个顶点`);
        
        this.validAllocationsCount = positions.length / 6; // 每个矩形6个顶点
    }

    //---------- 添加矩形顶点数据的辅助方法 ------------
    addRectangleVertices(positions, colors, types, borders, unitCoords, x1, y1, x2, y2, color, type, border) {
      // *** DEBUG TODO确保矩形有最小尺寸 ***
      const minWidth = 0.001; // 世界坐标系中的最小宽度
      const minHeight = 0.001; // 世界坐标系中的最小高度
      
      if (Math.abs(x2 - x1) < minWidth) {
          x2 = x1 + (x2 > x1 ? minWidth : -minWidth);
      }
      if (Math.abs(y2 - y1) < minHeight) {
          y2 = y1 + (y2 > y1 ? minHeight : -minHeight);
      }

        // 第一个三角形 - 左下、右下、左上
        positions.push(x1, y1); // 左下
        positions.push(x2, y1); // 右下
        positions.push(x1, y2); // 左上
        
        // 第二个三角形 - 右下、右上、左上
        positions.push(x2, y1); // 右下
        positions.push(x2, y2); // 右上  
        positions.push(x1, y2); // 左上

        // 为6个顶点添加相同的属性
        for (let i = 0; i < 6; i++) {
            colors.push(...color);
            types.push(type);
            borders.push(border);
            unitCoords.push(0,0, 1,0, 0,1, 1,0, 1,1, 0,1);
        }
    }

    // -------------计算总时间步数（考虑循环范围）----------------
    calculateTotalTimesteps(allocations = []) {
        if (allocations.length === 0) return 1;
        
        let maxTimestep = 0;
        
        allocations.forEach(alloc => {
            // 对于正常范围，取最大值
            if (alloc.timestep_start <= alloc.timestep_end) {
                maxTimestep = Math.max(maxTimestep, alloc.timestep_end);
            }
            // 对于循环范围，起始时间步可能更大
            else {
                maxTimestep = Math.max(maxTimestep, alloc.timestep_start);
            }
        });
        // 返回最大时间步+1（因为时间步从0开始）
        return maxTimestep + 1;
    }

    uploadGridBuffer(gridData) {
        const gl = this.gl;

        this.uploadBufferData('position', gridData.vertices, true);
        this.uploadBufferData('width', gridData.widths, true);
        this.uploadBufferData('type', gridData.types, true);
        this.gridVertexCount = gridData.vertexCount;
        
        console.log('网格数据上传完成:', {
            顶点数量: gridData.vertexCount,
            位置数据长度: gridData.vertices.length,
            线宽数据长度: gridData.widths.length,
            类型数据长度: gridData.types.length
        });
    }




    // // -----------------**** 坐标轴绘制 *****--------------------
    drawAxisLabels(data) {
        if (!data) return;
        
        const gridRange = this.getGridRange(data);
        const { bankSize, maxMemory, bankNum } = this.calculateDimensions(data.settings);
        
        this.canvas2d.clear();
        
        // 绘制坐标轴
        this.canvas2d.drawXAxis(this.worldToScreen.bind(this), gridRange, {
            majorTickInterval: 1,
            padding: 25
        });
        
        this.canvas2d.drawYAxis(this.worldToScreen.bind(this), gridRange, maxMemory, bankSize, bankNum, {
            padding: 25,
            showBankLabels: true,
            showAddressLabels: true
        });
        
        this.canvas2d.drawAxisTitles('Time Step', 'Memory Address', this.worldToScreen.bind(this), gridRange, 40);
    }


    getGridRange(data) {
        const { settings, allocations } = data;
        const { bankSize, maxMemory } = this.calculateDimensions(settings);
        const totalTimesteps = this.calculateTotalTimesteps(allocations);
        
        // 返回网格的实际范围（不包含边距）
        return {
            left: -0.5, // 网格从-0.5开始绘制
            right: totalTimesteps - 0.5, // 网格到totalTimesteps-0.5结束
            bottom: 0,
            top: maxMemory
        };
    }


    // 每次渲染前，把 viewMatrix 反推出真正的可见范围
    updateViewRangeFromMatrix() {
        const m = this.viewMatrix;
        // 正交矩阵 ortho(l,r,b,t) 的逆可直接给出四元
        const l = (-1 - m[12]) / m[0];
        const r = ( 1 - m[12]) / m[0];
        const b = (-1 - m[13]) / m[5];
        const t = ( 1 - m[13]) / m[5];
        this.viewRange = { left: l, right: r, bottom: b, top: t };
    }




 }