import { CIUDAD_CONFIG, SIMULACION_CONFIG } from '../config.js';

/**
 * SimuladorSensores
 * Genera mensajes ficticios con la MISMA forma que un mensaje MQTT real
 * (sensor_id, x, y, temperature, humidity, timestamp) y los entrega por
 * un callback, exactamente como haría MQTTClient con 'message'.
 *
 * Este módulo es reemplazable: el día que exista un simulador real en
 * C/MPI publicando al broker, esta clase se apaga y se usa MQTTClient
 * en su lugar. Ninguno de los otros módulos (Ciudad, render, métricas)
 * sabe ni le importa de dónde vino el mensaje.
 */
export class SimuladorSensores {
  constructor({
    cantidadSensores = SIMULACION_CONFIG.cantidadSensoresDefault,
    intervaloMs = SIMULACION_CONFIG.intervaloEmisionMs,
    mensajesPorLote = SIMULACION_CONFIG.mensajesPorLote,
  } = {}) {
    this.cantidadSensores = cantidadSensores;
    this.intervaloMs = intervaloMs;
    this.mensajesPorLote = mensajesPorLote;

    this._sensoresBase = [];
    this._intervalId = null;
    this._onMensaje = null;
  }

  onMensaje(callback) {
    this._onMensaje = callback;
  }

  _crearSensoresBase() {
    const zonas = CIUDAD_CONFIG.zonas;
    this._sensoresBase = Array.from({ length: this.cantidadSensores }, (_, i) => ({
      sensor_id: `sensor_${String(i).padStart(6, '0')}`,
      x: Math.round(Math.random() * CIUDAD_CONFIG.ancho),
      y: Math.round(Math.random() * CIUDAD_CONFIG.alto),
      zona: zonas[i % zonas.length],
    }));
  }

  _numeroAleatorio([min, max]) {
    return Number((min + Math.random() * (max - min)).toFixed(1));
  }

  _emitirLote() {
    if (!this._onMensaje) return;
    const [tMin, tMax] = SIMULACION_CONFIG.temperaturaRango;
    const [hMin, hMax] = SIMULACION_CONFIG.humedadRango;

    for (let i = 0; i < this.mensajesPorLote; i++) {
      const base = this._sensoresBase[Math.floor(Math.random() * this._sensoresBase.length)];
      this._onMensaje({
        sensor_id: base.sensor_id,
        x: base.x,
        y: base.y,
        zona: base.zona,
        temperature: this._numeroAleatorio([tMin, tMax]),
        humidity: this._numeroAleatorio([hMin, hMax]),
        timestamp: Math.floor(Date.now() / 1000),
      });
    }
  }

  iniciar() {
    if (this._intervalId) return; // ya corriendo
    this._crearSensoresBase();
    this._intervalId = setInterval(() => this._emitirLote(), this.intervaloMs);
  }

  detener() {
    if (this._intervalId) {
      clearInterval(this._intervalId);
      this._intervalId = null;
    }
  }

  estaCorriendo() {
    return this._intervalId !== null;
  }
}
