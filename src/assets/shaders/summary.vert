attribute vec2 aPosition;
attribute vec4 aColor;

uniform   mat4 uViewMatrix;

varying   vec4 vColor;

void main() {
  gl_Position = uViewMatrix * vec4(aPosition, 0.0, 1.0);
  vColor      = aColor * 0.8;
}