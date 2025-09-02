// precision mediump float;
// varying float vValue;
// void main() {
//   vec3 c = vec3(0.2, 0.6, 1.0);
//   gl_FragColor = vec4(c * (0.3 + 0.7 * vValue), 1.0);
// }


precision mediump float;
varying vec4 vColor;
void main() {
  gl_FragColor = vColor;
}