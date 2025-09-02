#ifdef GL_ES
precision highp float;
#endif

varying float vLineWidth;
varying float vLineType;

void main() {
    // 虚线效果 - 基于屏幕坐标
    vec2 screenPos = gl_FragCoord.xy;
    float pattern;

    if (vLineType == 0.0) {               // 竖线
        float pos = mod(screenPos.x, 4.0); // 原来是 15
        pattern = step(0.0, pos - 2.0);    // 2px 实线 2px 空白
    } else if (vLineType == 1.0) {        // 横线
        float pos = mod(screenPos.y, 6.0); // 原来是 25
        pattern = step(0.0, pos - 3.0);    // 3px 实线 3px 空白
    } else {
        pattern = 1.0;
    }
    
    //if (pattern < 0.05) discard;

    vec4 color;
    if (vLineType == 0.0) {
            color = vec4(0.36, 0.35, 0.35, 0.6);   // 次时间步线
    } else if (vLineType == 1.0) {
            color = vec4(0.39, 0.38, 0.38, 0.6);  // 次Bank线
    } else {
        color = vec4(1.0, 0.0, 0.0, 0.6); // 最大内存线
    }
    
    gl_FragColor = color;
}
