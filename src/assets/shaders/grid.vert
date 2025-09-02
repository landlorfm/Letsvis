#ifdef GL_ES
precision highp float;
#endif

attribute vec2 aPosition;
attribute float aLineWidth;
attribute float aLineType; // 0: 时间步线, 1: Bank线, 2: 最大内存线

uniform mat4 uViewMatrix;
uniform vec2 uScreenSize;

varying float vLineWidth;
varying float vLineType;

void main() {
    gl_Position = uViewMatrix * vec4(aPosition, 0.0, 1.0);
    
    // 计算屏幕空间线宽
    vec2 screenFactor = vec2(2.0 / uScreenSize.x, 2.0 / uScreenSize.y);
    vLineWidth = aLineWidth * min(screenFactor.x, screenFactor.y);
    vLineType = aLineType;
}