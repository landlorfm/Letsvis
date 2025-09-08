import { mat4, vec2 } from 'gl-matrix';
export class ZoomHandler {
  constructor(canvas, viewMatrix) {
    this.canvas = canvas;
    this.viewMatrix = viewMatrix; // 直接存储矩阵引用
    this.scale = 1.0;
    this.maxScale = 5.0;
    this.minScale = 0.2;
    this.onZoom = null; // 缩放事件回调
    this.init();
  }

  init() {
    this.wheelHandler = (e) => {
      e.preventDefault();
      const delta = -Math.sign(e.deltaY) * 0.1;
      this.zoom(1 + delta, e.clientX, e.clientY);
    };
    
    this.canvas.addEventListener('wheel', this.wheelHandler);
  }


  zoom(factor, centerX, centerY) {
    const newScale = this.scale * factor;
    if (newScale < this.minScale || newScale > this.maxScale) return;

    // 获取画布相对位置和尺寸
    const rect = this.canvas.getBoundingClientRect();
    const canvasWidth = rect.width;
    const canvasHeight = rect.height;
    
    // 将鼠标坐标转换为标准化设备坐标 [-1, 1]
    const x = ((centerX - rect.left) / canvasWidth) * 2 - 1;
    const y = 1 - ((centerY - rect.top) / canvasHeight) * 2;

    // 创建缩放前的逆矩阵，用于计算世界坐标
    const invViewMatrix = mat4.create();
    mat4.invert(invViewMatrix, this.viewMatrix);
    
    // 获取鼠标位置的世界坐标
    const worldPos = vec2.transformMat4([0, 0], [x, y], invViewMatrix);

    // 应用缩放：先平移到原点，缩放，再平移回去
    mat4.translate(this.viewMatrix, this.viewMatrix, [worldPos[0], worldPos[1], 0]);
    mat4.scale(this.viewMatrix, this.viewMatrix, [factor, factor, 1]);
    mat4.translate(this.viewMatrix, this.viewMatrix, [-worldPos[0], -worldPos[1], 0]);
    
    this.scale = newScale;

    // 触发缩放回调
    if (this.onZoom && typeof this.onZoom === 'function') {
      this.onZoom(this.scale);
    }
  }


  // 重置缩放
  // reset() {
  //     // 保存原始数据引用
  //     const originalData = this.viewMatrix.slice();
      
  //     // 重置为单位矩阵
  //     mat4.identity(this.viewMatrix);
      
  //     this.scale = 1.0;
      
  //     // 触发缩放回调
  //     if (this.onZoom && typeof this.onZoom === 'function') {
  //         this.onZoom(this.scale);
  //     }
      
  //     console.log('缩放已重置');
  // }

  destroy() {
    // 清理事件监听器
    this.canvas.removeEventListener('wheel', this.wheelHandler);
  }
}