// ===== DEBUG ===== 三原色区分类型
// precision mediump float;

// varying vec4  vColor;
// varying vec2  vUv;
// varying float vType;

// void main() {
//     // 1. 直接把 vType 映射成纯色
//     vec3 c;
//     if      (vType > 1.5) c = vec3(1.0,0.0,0.0);  // 红 = 星号
//     else if (vType > 0.5) c = vec3(0.0,1.0,0.0);  // 绿 = 斜线
//     else                  c = vec3(0.0,0.0,1.0);  // 蓝 = 无图案

//     gl_FragColor = vec4(c, 1.0);
// }




// ====== DEBUG ======= unitCoord 属性测试
// precision mediump float;

// varying vec4  vColor;
// varying vec2  vUnitCoord;   // 注意名字要一致
// varying float vType;

// void main() {
//     // 直接用 aUnitCoord 当颜色
//     gl_FragColor = vec4(vUnitCoord, 0.0, 1.0);
// }




precision mediump float;

varying vec4  vColor;
varying vec2  vUv;
varying float vType;
varying float vBorder;

/* ---------- 新增：图案增强参数 ---------- */
const float kDensity   = 10.0;        // 4×4 像素一个大像素
const float kDotSize   = 0.75;       // 实心块占单元格比例（0~1）
const float kLineWidth = 0.20;       // 斜线/十字线的线宽（0~1）
const float kAAFactor  = 0.25;       // 抗锯齿比例，让线条更柔和

/* ---------- 工具：抗锯齿 Step ---------- */
float aastep(float threshold, float value) {
    float afwidth = kAAFactor / kDensity;
    return smoothstep(threshold - afwidth, threshold + afwidth, value);
}

void main() {
    /* 1. 计算当前处于哪个“大像素” */
    vec2 cell   = floor(vUv * kDensity);           // 整数单元坐标
    vec2 cellUV = fract(vUv * kDensity);           // 单元内局部 0~1

    /* 2. 生成图案掩码 pattern (0 或 1) */
    float pattern = 0.0;

    if (vType > 1.5) {
        /* ---- 星号（十字线） ---- */
        // 1. 棋盘屏蔽：只在 (x+y) 为偶数的格子画线
        float cellMask = 1.0 - mod(cell.x + cell.y, 2.0);   // 0 或 1

        // 2. 普通十字线
        float cx = aastep(0.5 - kLineWidth * 0.5, cellUV.x) -
                   aastep(0.5 + kLineWidth * 0.5, cellUV.x);
        float cy = aastep(0.5 - kLineWidth * 0.5, cellUV.y) -
                   aastep(0.5 + kLineWidth * 0.5, cellUV.y);
        float cross = clamp(cx + cy, 0.0, 1.0);

        // 3. 只在棋盘允许的位置出现
        pattern = cross * cellMask;

    } else if (vType > 0.5) {
        /* ---- 斜线（左下到右上） ---- */
        float d = cellUV.x + cellUV.y;               // 对角线方程
        float halfW = kLineWidth * 0.5;
        pattern = aastep(1.0 - halfW, d) - aastep(1.0 + halfW, d);
    }

    /* 3. 失败边框（保持不变） */
    float edge = min(min(vUv.x, 1.0 - vUv.x),
                     min(vUv.y, 1.0 - vUv.y));
    if (vBorder > 0.5 && edge < 0.05) {
        gl_FragColor = vec4(0.9, 0.2, 0.2, 1.0);
        return;
    }

    /* 4. 最终颜色：底色与图案混合 */
    vec4 patternColor = vec4(0.0, 0.0, 0.0, 0.8);   // 70% 黑色覆盖
    gl_FragColor = mix(vColor, patternColor, pattern);
}