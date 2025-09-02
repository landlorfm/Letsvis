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
}