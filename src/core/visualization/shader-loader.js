const SHADERS = {
  memory: {
    vert: `
precision highp float;

attribute vec2 aPosition;
attribute vec2 aSize;
attribute vec4 aColor;
attribute float aType;
attribute float aBorder;

uniform mat4 uViewMatrix;

varying vec4 vColor;
varying vec2 vPosition;
varying vec2 vSize;
varying float vBorder;
varying float vType;

// 传递顶点ID的替代方案：使用额外的attribute
attribute float aVertexID;

void main() {
    // 根据顶点ID计算矩形顶点的相对位置
    vec2 vertexPos = vec2(0.0);
    if (aVertexID == 0.0) vertexPos = vec2(0.0, 0.0);
    else if (aVertexID == 1.0) vertexPos = vec2(1.0, 0.0);
    else if (aVertexID == 2.0) vertexPos = vec2(0.0, 1.0);
    else vertexPos = vec2(1.0, 1.0);
    
    // 计算世界坐标
    vec2 worldPos = aPosition + vertexPos * aSize;
    
    // 应用视图变换
    gl_Position = uViewMatrix * vec4(worldPos, 0.0, 1.0);
    
    // 传递变量到片元着色器
    vColor = aColor;
    vPosition = aPosition;
    vSize = aSize;
    vBorder = aBorder;
    vType = aType;
}`,

    frag: `
precision mediump float;

varying vec4 vColor;
varying vec2 vPosition;
varying vec2 vSize;
varying float vBorder;
varying float vType;

void main() {
    // 暂时只显示纯色，确保矩形能显示
    gl_FragColor = vColor;
    
    // 简单的边框效果
    if (vBorder > 0.5) {
        gl_FragColor.rgb *= 0.7;
    }
}`
  },

  grid: {
    vert: `
precision mediump float;
attribute vec2 aPos;
uniform mat4 uViewMatrix;
void main() {
  gl_Position = uViewMatrix * vec4(aPos, 0.0, 1.0);
}`,
    frag: `
precision mediump float;
void main() {
  gl_FragColor = vec4(0.85, 0.85, 0.85, 1.0);
}`
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
attribute float aValue;
uniform float uMaxValue;
varying float vValue;
void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
  vValue = aValue / uMaxValue;
}`,
    frag: `
precision mediump float;
varying float vValue;
void main() {
  vec3 c = vec3(0.2, 0.6, 1.0);
  gl_FragColor = vec4(c * (0.3 + 0.7 * vValue), 1.0);
}`
  }
};




/* ---------- 其余 compile 逻辑不变 ---------- */
export class ShaderLoader {
  // static async load(gl, name) {
  //   if (!SHADERS[name]) throw new Error(`Shader set "${name}" not found`);
  //   return SHADERS[name];
  // }

  // 根据名称返回 {vert, frag} 字符串
  static async load(gl, name) {
    const base = new URL('../../assets/shaders', import.meta.url).href;
    const [vert, frag] = await Promise.all([
      fetch(`${base}/${name}.vert`).then(r => r.text()),
      fetch(`${base}/${name}.frag`).then(r => r.text())
    ]);
    return { vert, frag };
  }

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