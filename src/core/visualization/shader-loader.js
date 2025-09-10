const SHADERS = {
  memory: {
    vert: `
precision highp float;
attribute vec2 aPosition;
attribute vec2 aSize;
attribute vec4 aColor;
attribute float aType;
attribute float aBorder;
attribute vec2 aUnitCoord;

uniform mat4 uViewMatrix;
uniform vec2 uScreenSize;

varying vec4  vColor;
varying vec2  vUv;
varying float vType;
varying float vBorder;
varying vec2  vUnitCoord;

void main() {
    vec2 worldPos = aPosition + aUnitCoord * aSize;
    gl_Position   = uViewMatrix * vec4(worldPos, 0.0, 1.0);
    vUv           = aUnitCoord;
    vColor        = aColor;
    vType         = aType;
    vBorder       = aBorder;
    vUnitCoord    = aUnitCoord;
}`,

    frag: `
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
    `
  },

  grid: {
    vert: `
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
}`,
    frag: `
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
`
  },

  tooltip: {
    vert: `
attribute vec2 aPos;
uniform mat4 uViewMatrix;
void main() {
  gl_Position = uViewMatrix * vec4(aPos, 0.0, 1.0);
}`,
    frag: `
precision mediump float;
void main() {
  gl_FragColor = vec4(0.0, 0.0, 0.0, 0.75);
}`
  },

  summary: {
    vert: `
attribute vec2 aPosition;
attribute vec4 aColor;

uniform   mat4 uViewMatrix;

varying   vec4 vColor;

void main() {
  gl_Position = uViewMatrix * vec4(aPosition, 0.0, 1.0);
  vColor      = aColor * 0.8;
}`,
    frag: `
precision mediump float;
varying vec4 vColor;
void main() {
  gl_FragColor = vColor;
}`
  }
};




/* ---------- 其余 compile 逻辑不变 ---------- */
export class ShaderLoader {
  static async load(gl, name) {
    if (!SHADERS[name]) throw new Error(`Shader set "${name}" not found`);
    return SHADERS[name];
  }

  // // 根据名称返回 {vert, frag} 字符串
  // static async load(gl, name) {
  //   const base = new URL('../../assets/shaders', import.meta.url).href;
  //   const [vert, frag] = await Promise.all([
  //     fetch(`${base}/${name}.vert`).then(r => r.text()),
  //     fetch(`${base}/${name}.frag`).then(r => r.text())
  //   ]);
  //   return { vert, frag };
  // }

  static compile(gl, vsSrc, fsSrc) {
    const vs = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vs, vsSrc);
    gl.compileShader(vs);
    if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS))
      throw new Error('VS error: ' + gl.getShaderInfoLog(vs));

    const fs = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fs, fsSrc);
    gl.compileShader(fs);
    if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS))
      throw new Error('FS error: ' + gl.getShaderInfoLog(fs));

    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS))
      throw new Error('Link error: ' + gl.getProgramInfoLog(prog));

    gl.detachShader(prog, vs);
    gl.detachShader(prog, fs);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    return prog;
  }
}