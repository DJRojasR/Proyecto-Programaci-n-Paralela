/**
 * shaders.js
 * Un punto por sensor. El color y el tamaño viajan por atributo
 * (no por uniform) para poder dibujar todos los sensores en una
 * sola llamada draw, sea que haya 10 mil o 1 millón.
 */

export const VERTEX_SHADER = `
  attribute vec2 a_posicion;   // coordenadas de ciudad, normalizadas [-1, 1] en JS
  attribute vec3 a_color;
  attribute float a_intensidad; // 0 = apagado/idle, 1 = recién transmitió

  varying vec3 v_color;
  varying float v_intensidad;

  uniform float u_radioBase;

  void main() {
    v_color = a_color;
    v_intensidad = a_intensidad;
    gl_Position = vec4(a_posicion, 0.0, 1.0);
    gl_PointSize = u_radioBase * (1.0 + a_intensidad * 0.8);
  }
`;

export const FRAGMENT_SHADER = `
  precision mediump float;

  varying vec3 v_color;
  varying float v_intensidad;

  void main() {
    // Punto circular con borde suave, en vez de un cuadrado crudo
    vec2 centrado = gl_PointCoord - vec2(0.5);
    float dist = length(centrado);
    if (dist > 0.5) discard;

    float borde = smoothstep(0.5, 0.35, dist);
    float halo = v_intensidad * smoothstep(0.5, 0.0, dist) * 0.4;

    gl_FragColor = vec4(v_color, borde + halo);
  }
`;
