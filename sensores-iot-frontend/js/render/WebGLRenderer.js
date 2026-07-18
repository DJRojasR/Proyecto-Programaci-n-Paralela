import { VERTEX_SHADER, FRAGMENT_SHADER } from './shaders.js';
import { CIUDAD_CONFIG, VISUAL_CONFIG } from '../config.js';

/**
 * WebGLRenderer
 * Dibuja todos los sensores de la Ciudad como una única nube de
 * puntos GPU-acelerada. La razón de ser de este módulo: hacerlo con
 * un <div> por sensor no escala a 100k+; con WebGL, un solo draw call
 * pinta todos los puntos sin importar cuántos sean.
 *
 * Solo se encarga de dibujar. No conoce MQTT ni el modelo de datos
 * completo: recibe arreglos planos [x, y, r, g, b, intensidad] listos
 * para subir a la GPU.
 */
export class WebGLRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.gl = canvas.getContext('webgl', { antialias: true, alpha: true });

    if (!this.gl) {
      throw new Error('WebGL no está disponible en este navegador.');
    }

    this._programa = null;
    this._buffers = { posicion: null, color: null, intensidad: null };
    this._locs = {};
    this._cantidadPuntos = 0;

    this._initPrograma();
    this._resize();
    window.addEventListener('resize', () => this._resize());
  }

  _compilarShader(tipo, fuente) {
    const gl = this.gl;
    const shader = gl.createShader(tipo);
    gl.shaderSource(shader, fuente);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const info = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error(`Error compilando shader: ${info}`);
    }
    return shader;
  }

  _initPrograma() {
    const gl = this.gl;
    const vs = this._compilarShader(gl.VERTEX_SHADER, VERTEX_SHADER);
    const fs = this._compilarShader(gl.FRAGMENT_SHADER, FRAGMENT_SHADER);

    const programa = gl.createProgram();
    gl.attachShader(programa, vs);
    gl.attachShader(programa, fs);
    gl.linkProgram(programa);
    if (!gl.getProgramParameter(programa, gl.LINK_STATUS)) {
      throw new Error(`Error enlazando programa: ${gl.getProgramInfoLog(programa)}`);
    }
    this._programa = programa;

    this._locs.posicion = gl.getAttribLocation(programa, 'a_posicion');
    this._locs.color = gl.getAttribLocation(programa, 'a_color');
    this._locs.intensidad = gl.getAttribLocation(programa, 'a_intensidad');
    this._locs.radioBase = gl.getUniformLocation(programa, 'u_radioBase');

    this._buffers.posicion = gl.createBuffer();
    this._buffers.color = gl.createBuffer();
    this._buffers.intensidad = gl.createBuffer();

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  }

  _resize() {
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = this.canvas.clientWidth * dpr;
    this.canvas.height = this.canvas.clientHeight * dpr;
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  }

  /**
   * Convierte coordenadas de ciudad (0..ancho, 0..alto) a espacio
   * de clip de WebGL (-1..1), con Y invertido (pantalla vs. cartesiano).
   */
  _aClip(x, y) {
    const nx = (x / CIUDAD_CONFIG.ancho) * 2 - 1;
    const ny = 1 - (y / CIUDAD_CONFIG.alto) * 2;
    return [nx, ny];
  }

  /**
   * Recibe la lista de sensores (modelo Sensor[]) y sube sus
   * posiciones/colores a la GPU. Se llama una vez por frame o solo
   * cuando cambia el conjunto de sensores, según convenga en main.js.
   */
  actualizarPuntos(sensores) {
    const gl = this.gl;
    const n = sensores.length;
    this._cantidadPuntos = n;

    const posiciones = new Float32Array(n * 2);
    const colores = new Float32Array(n * 3);
    const intensidades = new Float32Array(n);

    sensores.forEach((s, i) => {
      const [cx, cy] = this._aClip(s.x, s.y);
      posiciones[i * 2] = cx;
      posiciones[i * 2 + 1] = cy;

      const color = s.estaActivo() ? VISUAL_CONFIG.colorActivo : VISUAL_CONFIG.colorInactivo;
      colores[i * 3] = color[0];
      colores[i * 3 + 1] = color[1];
      colores[i * 3 + 2] = color[2];

      intensidades[i] = s.estaActivo() ? 1.0 : 0.0;
    });

    gl.bindBuffer(gl.ARRAY_BUFFER, this._buffers.posicion);
    gl.bufferData(gl.ARRAY_BUFFER, posiciones, gl.DYNAMIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, this._buffers.color);
    gl.bufferData(gl.ARRAY_BUFFER, colores, gl.DYNAMIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, this._buffers.intensidad);
    gl.bufferData(gl.ARRAY_BUFFER, intensidades, gl.DYNAMIC_DRAW);
  }

  render() {
    const gl = this.gl;
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    if (this._cantidadPuntos === 0) return;

    gl.useProgram(this._programa);
    gl.uniform1f(this._locs.radioBase, VISUAL_CONFIG.radioPuntoPx * (window.devicePixelRatio || 1));

    gl.bindBuffer(gl.ARRAY_BUFFER, this._buffers.posicion);
    gl.enableVertexAttribArray(this._locs.posicion);
    gl.vertexAttribPointer(this._locs.posicion, 2, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, this._buffers.color);
    gl.enableVertexAttribArray(this._locs.color);
    gl.vertexAttribPointer(this._locs.color, 3, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, this._buffers.intensidad);
    gl.enableVertexAttribArray(this._locs.intensidad);
    gl.vertexAttribPointer(this._locs.intensidad, 1, gl.FLOAT, false, 0, 0);

    gl.drawArrays(gl.POINTS, 0, this._cantidadPuntos);
  }

  /** Inicia un loop de render continuo (útil para animar el fade a gris). */
  iniciarLoop(obtenerSensores) {
    const paso = () => {
      this.actualizarPuntos(obtenerSensores());
      this.render();
      requestAnimationFrame(paso);
    };
    requestAnimationFrame(paso);
  }
}
