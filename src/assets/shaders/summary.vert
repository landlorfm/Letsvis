// #version 300 es
// precision highp float;

// in float aTimestep;    // 时间步 [0, total_steps)
// in float aUsageValue;  // 内存使用量字节数
// in float aIsHighlight; // 是否高亮 0.0/1.0

// uniform float uMaxUsage; // 最大内存使用量（用于归一化）
// uniform vec2 uResolution;

// out float vIsHighlight;
// out vec3 vLineColor;

// void main() {
//     // X轴：时间步归一化 [-1,1]
//     float x = (aTimestep / uResolution.x) * 2.0 - 1.0;
    
//     // Y轴：使用量归一化 [-1,1]
//     float y = (aUsageValue / uMaxUsage) * 2.0 - 1.0;
    
//     gl_Position = vec4(x, y, 0.0, 1.0);
//     gl_PointSize = 6.0;
    
//     // 高亮颜色传递
//     vIsHighlight = aIsHighlight;
//     vLineColor = mix(
//         vec3(0.2, 0.6, 0.9), // 默认蓝色
//         vec3(0.9, 0.4, 0.2), // 高亮橙色
//         aIsHighlight
//     );
// }


// attribute vec2 aPosition;
// attribute float aValue;
// uniform float uMaxValue;
// varying float vValue;
// void main() {
//   gl_Position = vec4(aPosition, 0.0, 1.0);
//   vValue = aValue / uMaxValue;
// }


attribute vec2 aPosition;
attribute vec4 aColor;

uniform   mat4 uViewMatrix;

varying   vec4 vColor;

void main() {
  gl_Position = uViewMatrix * vec4(aPosition, 0.0, 1.0);
  vColor      = aColor * 0.8;
}