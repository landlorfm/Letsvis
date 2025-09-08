import { color } from "d3";

export class Canvas2DRenderer {
    constructor(webglCanvas, options = {}) {
        this.webglCanvas = webglCanvas;
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d');
        
        // 配置选项
        this.options = {
        zIndex: options.zIndex || 10,
        pointerEvents: options.pointerEvents !== undefined ? options.pointerEvents : 'none',
        className: options.className || 'letsvis-axis-overlay',
        ...options
        };
        
        this.setupCanvas();
        this.syncSize();
        
        // 事件代理相关
        this.eventProxyEnabled = options.eventProxy !== false;
        this.setupEventProxy();
    }
    
    setupCanvas() {
        Object.assign(this.canvas.style, {
        position: 'absolute',
        left: '0',
        top: '0',
        pointerEvents: this.options.pointerEvents,
        zIndex: this.options.zIndex.toString()
        });
        
        this.canvas.className = this.options.className;
        
        if (this.webglCanvas.parentElement) {
        this.webglCanvas.parentElement.style.position = 'relative';
        this.webglCanvas.parentElement.appendChild(this.canvas);
        }
    }

    clear() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }


    destroy() {
      // 移除事件监听器
      if (this.eventListeners) {
        this.eventListeners = {};
      }
      
      // 移除DOM元素
      if (this.canvas.parentNode) {
        this.canvas.parentNode.removeChild(this.canvas);
      }
      this.canvas.remove();

      // 触发destroy事件
      this.emit('destroy', null);
    }
        
    // syncSize() {
    //     const dpr = window.devicePixelRatio || 1;
    //     const displayWidth = Math.floor(this.webglCanvas.clientWidth * dpr);
    //     const displayHeight = Math.floor(this.webglCanvas.clientHeight * dpr);
        
    //     this.canvas.width = displayWidth;
    //     this.canvas.height = displayHeight;
    //     this.canvas.style.width = this.webglCanvas.clientWidth + 'px';
    //     this.canvas.style.height = this.webglCanvas.clientHeight + 'px';
        
    //     this.ctx.scale(dpr, dpr);
        
    //     // 触发resize事件
    //     this.emit('resize', { width: displayWidth, height: displayHeight });
    // }
    // Canvas2DRenderer.js
    syncSize() {
      // 完全照搬 WebGL 的物理像素
      const { width, height } = this.webglCanvas;
      if (this.canvas.width !== width || this.canvas.height !== height) {
        this.canvas.width  = width;
        this.canvas.height = height;
        // CSS 尺寸继续跟随外层元素即可
        this.canvas.style.width  = this.webglCanvas.style.width  || `${this.webglCanvas.clientWidth}px`;
        this.canvas.style.height = this.webglCanvas.style.height || `${this.webglCanvas.clientHeight}px`;
      }
      // 2D context 的 scale 也要同步 dpr
      const dpr = window.devicePixelRatio || 1;
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // 触发resize事件
      this.emit('resize', { width: width, height: height });
    }

    
    // 事件代理设置：让2D canvas上的事件传递到WebGL canvas
    setupEventProxy() {
        if (!this.eventProxyEnabled) return;
        
        const events = ['mousedown', 'mouseup', 'mousemove', 'click', 'dblclick', 
                    'touchstart', 'touchend', 'touchmove', 'wheel'];
        
        events.forEach(eventType => {
        this.canvas.addEventListener(eventType, (e) => {
            // 创建新事件并重定向到WebGL canvas
            const newEvent = new e.constructor(e.type, e);
            this.webglCanvas.dispatchEvent(newEvent);
            
            // 阻止默认行为（如果需要）
            if (e.cancelable) {
            e.preventDefault();
            }
            e.stopPropagation();
        });
        });
    }

    
    // 事件系统兼容
    on(event, callback) {
        if (!this.eventListeners) this.eventListeners = {};
        if (!this.eventListeners[event]) this.eventListeners[event] = [];
        this.eventListeners[event].push(callback);
    }
    
    off(event, callback) {
        if (!this.eventListeners || !this.eventListeners[event]) return;
        this.eventListeners[event] = this.eventListeners[event].filter(cb => cb !== callback);
    }
    
    emit(event, data) {
        if (!this.eventListeners || !this.eventListeners[event]) return;
        this.eventListeners[event].forEach(callback => callback(data));
    }
    
    clear() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }



    drawText(text, x, y, options = {}) {
        const {
        color = '#000',
        fontSize = 12,
        fontFamily = 'Arial',
        align = 'center',
        baseline = 'middle'
        } = options;
        
        this.ctx.font = `${fontSize}px ${fontFamily}`;
        this.ctx.fillStyle = color;
        this.ctx.textAlign = align;
        this.ctx.textBaseline = baseline;
        
        this.ctx.fillText(text, x, y);
    }
  
  drawLine(x1, y1, x2, y2, options = {}) {
    const {
      color = '#666',
      width = 1,
      dash = []
    } = options;
    
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = width;
    
    if (dash.length > 0) {
      this.ctx.setLineDash(dash);
    }
    
    this.ctx.beginPath();
    this.ctx.moveTo(x1, y1);
    this.ctx.lineTo(x2, y2);
    this.ctx.stroke();
    
    this.ctx.setLineDash([]);
  }
  
  // 坐标轴专用方法
  drawXAxis(worldToScreen, gridRange, options = {}) {
    const {
      padding = 40,
      tickSize = 4,
      majorTickInterval = 1,
      showLabels = true
    } = options;
    
    const canvasWidth = this.canvas.width / (window.devicePixelRatio || 1);
    
    // 绘制X轴线
    const xAxisY = worldToScreen([0, gridRange.bottom])[1];
    this.drawLine(padding, xAxisY, canvasWidth - padding, xAxisY, { color: '#666', width: 1 });
    //console.log('[对齐] X轴坐标', xAxisY, '世界坐标', gridRange.bottom);

    // 绘制时间步刻度
    for (let ts = 0; ts <= gridRange.right; ts++) {
      if (ts % majorTickInterval !== 0) continue;
      
      const screenX = worldToScreen([ts, 0])[0];
      if (screenX < padding || screenX > canvasWidth - padding) continue;
      if(ts < 3){
        //console.log('[对齐] 时间步刻度屏幕坐标', screenX, '世界坐标', ts);
      }
      
      
      // 绘制刻度线
      const isMajor = ts % majorTickInterval === 0;
      this.drawLine(screenX, xAxisY, screenX, xAxisY + tickSize, {
        color: isMajor ? '#333' : '#999',
        width: isMajor ? 2 : 1
      });
      
      // 绘制标签
      if (showLabels && isMajor) {
        this.drawText(ts.toString(), screenX, xAxisY + 15, {
          color: '#333',
          fontSize: 12,
          align: 'center',
          baseline: 'top'
        });
      }
    }
  }
  
  drawYAxis(worldToScreen, gridRange, maxMemory, bankSize, bankNum, options = {}) {
    const {
      padding = 40,
      tickSize = 4,
      showBankLabels = true,
      showAddressLabels = true,
      showMaxMemoryLabel = true,
    } = options;
    
    const canvasHeight = this.canvas.height / (window.devicePixelRatio || 1);
    const yAxisX = worldToScreen([gridRange.left, 0])[0];
    const yAxisXR = worldToScreen([gridRange.right, 0])[0];
    
    // 绘制Y轴线
    this.drawLine(yAxisX, padding, yAxisX, canvasHeight, { color: '#666', width: 1 });
    //console.log('[对齐] Y轴坐标', yAxisX, '世界坐标', gridRange.left);

    
    // 绘制Bank刻度和标签
    for (let bank = 0; bank <= bankNum; bank++) {
      const bankAddress = bank * bankSize;
      if (bankAddress > maxMemory) continue;
      
      const screenY = worldToScreen([0, bankAddress])[1];
      
      // 左侧刻度
      this.drawLine(yAxisX, screenY, yAxisX - tickSize, screenY, {
        color: '#333',
        width: 2
      });
      
      
      // bank地址标签
      if (showAddressLabels) {
        this.drawText(this.formatMemorySize(bankAddress), yAxisX - 15, screenY + 4, {
          color: '#333',
          fontSize: 12,
          align: 'right',
          baseline: 'middle'
        });
      }
      
      // Bank编号标签（在右侧）
      if (showBankLabels && bank < bankNum) {
        const halfBankHeight = (worldToScreen([0, bankSize])[1] - worldToScreen([0, 0])[1]) / 2;
        this.drawText(`Bank ${bank}`, yAxisXR + 10, screenY - 10, {
          color: '#333',
          fontSize: 12,
          align: 'left',
          baseline: 'middle'
        });

        // 右侧刻度
        this.drawLine(yAxisXR, screenY+halfBankHeight, yAxisXR - tickSize, screenY+halfBankHeight,{
            color: '#999',
            width: 1
        });
      }
    }
    
    // 最大内存标签
    if(showMaxMemoryLabel){
      const maxMemScreenY = worldToScreen([0, maxMemory])[1];
      this.drawText(`Max: ${maxMemory}`, yAxisX - 15, maxMemScreenY - 10, {
        color: '#333',
        fontSize: 12,
        align: 'right',
        baseline: 'middle'
      });
    }

  }
  
  drawAxisTitles(xLabel, yLabel, worldToScreen, gridRange, padding = 40) {
    const canvasWidth = this.canvas.width / (window.devicePixelRatio || 1);
    const canvasHeight = this.canvas.height / (window.devicePixelRatio || 1);
    
    const xAxisY = worldToScreen([0, gridRange.bottom])[1];
    const yAxisX = worldToScreen([gridRange.left, 0])[0];
    
    // X轴标题
    this.drawText(xLabel, canvasWidth / 2, xAxisY + 30, {
      color: '#666',
      fontSize: 14,
      align: 'center',
      baseline: 'top'
    });
    
    const ctx = this.ctx;  
    ctx.save();
    // ---------- Y 轴标题 ----------
    const yLabelX = yAxisX - 70;           // 当前水平位置
    const yLabelY = canvasHeight / 2;      // 当前垂直位置

    ctx.translate(yLabelX, yLabelY);       // 移动到文字中心
    ctx.rotate(-Math.PI / 2);              // 逆时针 90°

    // 绘制文字（此时坐标系已旋转，x=0, y=0 就是中心点）
    this.drawText(yLabel, 0, 0, {
        color: '#666',
        fontSize: 14,
        align: 'center',
        baseline: 'middle'
    });

    ctx.restore();                         // 恢复上下文
    
  }
  
  formatMemorySize(bytes) {
    if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + 'MB';
    if (bytes >= 1024) return (bytes / 1024).toFixed(1) + 'KB';
    return bytes + 'B';
  }
  
}