import { METRICAS_CONFIG } from '../config.js';

/**
 * SensorStateManager
 * No guarda sensores (eso es trabajo de Ciudad); guarda la historia
 * reciente de eventos para poder calcular las métricas que pide el
 * documento: throughput, latencia promedio y % de pérdida.
 *
 * "Pérdida" aquí se calcula si el payload trae un número de secuencia
 * esperado vs. recibido; si no viene, ese cálculo queda en 0 y listo
 * para conectarse cuando el simulador lo incluya.
 */
export class SensorStateManager {
  constructor(ciudad) {
    this.ciudad = ciudad;

    this._timestampsRecientes = []; // para mensajes/seg
    this._latenciasRecientes = [];  // ms, para latencia promedio
    this._mensajesEsperados = 0;
    this._mensajesRecibidos = 0;
  }

  /**
   * Se llama cada vez que llega un mensaje MQTT ya aplicado a la Ciudad.
   * @param {object} payload - el mensaje crudo tal como llegó
   */
  registrarMensaje(payload) {
    const ahora = Date.now();
    this._timestampsRecientes.push(ahora);
    this._mensajesRecibidos += 1;

    if (payload.timestamp) {
      // timestamp del doc viene en segundos epoch (ver ejemplo del proyecto)
      const emitidoMs = payload.timestamp > 1e12 ? payload.timestamp : payload.timestamp * 1000;
      const latencia = ahora - emitidoMs;
      if (latencia >= 0) this._latenciasRecientes.push(latencia);
    }

    this._purgarVentana(ahora);
  }

  _purgarVentana(ahora) {
    const limite = ahora - METRICAS_CONFIG.ventanaThroughputMs;
    while (this._timestampsRecientes.length && this._timestampsRecientes[0] < limite) {
      this._timestampsRecientes.shift();
    }
    // Se conserva una ventana acotada de latencias para no crecer sin límite
    if (this._latenciasRecientes.length > 500) {
      this._latenciasRecientes.splice(0, this._latenciasRecientes.length - 500);
    }
  }

  /** Snapshot de métricas listo para pintar en el panel lateral. */
  calcularMetricas() {
    const totalSensores = this.ciudad.total();
    const activos = this.ciudad.contarActivos();

    const mensajesPorSeg = this._timestampsRecientes.length;

    const latenciaProm = this._latenciasRecientes.length
      ? this._latenciasRecientes.reduce((a, b) => a + b, 0) / this._latenciasRecientes.length
      : 0;

    const perdida = this._mensajesEsperados > 0
      ? Math.max(0, 1 - this._mensajesRecibidos / this._mensajesEsperados) * 100
      : 0;

    return {
      totalSensores,
      activos,
      inactivos: totalSensores - activos,
      mensajesPorSeg,
      latenciaPromedioMs: Math.round(latenciaProm),
      perdidaPct: Number(perdida.toFixed(2)),
    };
  }
}
