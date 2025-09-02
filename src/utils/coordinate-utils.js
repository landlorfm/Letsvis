export class CoordinateUtils {
  /**
   * 世界坐标到屏幕坐标的转换
   * @param {Array} worldCoord - 世界坐标 [worldX, worldY]
   * @param {Object} viewRange - 视图范围 { left, right, bottom, top }
   * @param {HTMLCanvasElement} canvas - Canvas元素
   * @returns {Array} 屏幕坐标 [screenX, screenY]
   */
  static worldToScreen(worldCoord, viewRange, canvas) {
    const [worldX, worldY] = worldCoord;
    const { left, right, bottom, top } = viewRange;
    
    const screenX = ((worldX - left) / (right - left)) * canvas.width;
    const screenY = ((top - worldY) / (top - bottom)) * canvas.height;
    
    return [screenX, screenY];
  }

  /**
   * 屏幕坐标到世界坐标的转换
   * @param {Object} screenCoord - 屏幕坐标 { x, y }
   * @param {Object} viewRange - 视图范围 { left, right, bottom, top }
   * @param {HTMLCanvasElement} canvas - Canvas元素
   * @returns {Array} 世界坐标 [worldX, worldY]
   */
  static screenToWorld(screenCoord, viewRange, canvas) {
    const { x, y } = screenCoord;
    const { left, right, bottom, top } = viewRange;
    
    const worldX = left + (x / canvas.width) * (right - left);
    const worldY = bottom + (1 - y / canvas.height) * (top - bottom);
    
    return [worldX, worldY];
  }

  /**
   * WebGL坐标到屏幕坐标的转换（用于正交投影矩阵）
   * @param {Float32Array} viewMatrix - 4x4视图矩阵
   * @param {Array} webglCoord - WebGL坐标 [x, y]
   * @param {HTMLCanvasElement} canvas - Canvas元素
   * @returns {Array} 屏幕坐标 [screenX, screenY]
   */
  static webglToScreen(viewMatrix, webglCoord, canvas) {
    const [x, y] = webglCoord;
    const dpr = window.devicePixelRatio || 1;
    
    // 正交投影矩阵的逆转换
    const screenX = ((x - viewMatrix[12] / viewMatrix[0]) / (2 / viewMatrix[0]) + 0.5) * canvas.width / dpr;
    const screenY = (0.5 - y / (2 * viewMatrix[5])) * canvas.height / dpr;
    
    return [screenX, screenY];
  }

  /**
   * 计算设备像素比缩放后的坐标
   * @param {Array} coord - 原始坐标 [x, y]
   * @param {HTMLCanvasElement} canvas - Canvas元素
   * @returns {Array} 缩放后的坐标 [scaledX, scaledY]
   */
  static scaleToDPR(coord, canvas) {
    const dpr = window.devicePixelRatio || 1;
    const [x, y] = coord;
    
    return [x * dpr, y * dpr];
  }

  /**
   * 计算从设备像素比坐标还原的坐标
   * @param {Array} coord - 缩放后的坐标 [x, y]
   * @param {HTMLCanvasElement} canvas - Canvas元素
   * @returns {Array} 原始坐标 [originalX, originalY]
   */
  static scaleFromDPR(coord, canvas) {
    const dpr = window.devicePixelRatio || 1;
    const [x, y] = coord;
    
    return [x / dpr, y / dpr];
  }

  /**
   * 检查坐标是否在画布范围内
   * @param {Array} coord - 坐标 [x, y]
   * @param {HTMLCanvasElement} canvas - Canvas元素
   * @param {number} padding - 边距（可选）
   * @returns {boolean} 是否在范围内
   */
  static isInCanvas(coord, canvas, padding = 0) {
    const [x, y] = coord;
    return x >= padding && x <= canvas.width - padding && 
           y >= padding && y <= canvas.height - padding;
  }

  /**
   * 标准化坐标到 [0, 1] 范围
   * @param {Array} coord - 坐标 [x, y]
   * @param {HTMLCanvasElement} canvas - Canvas元素
   * @returns {Array} 标准化坐标 [normalizedX, normalizedY]
   */
  static normalize(coord, canvas) {
    const [x, y] = coord;
    return [x / canvas.width, y / canvas.height];
  }

  /**
   * 从标准化坐标还原
   * @param {Array} normalizedCoord - 标准化坐标 [nx, ny]
   * @param {HTMLCanvasElement} canvas - Canvas元素
   * @returns {Array} 原始坐标 [x, y]
   */
  static denormalize(normalizedCoord, canvas) {
    const [nx, ny] = normalizedCoord;
    return [nx * canvas.width, ny * canvas.height];
  }
}