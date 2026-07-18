import { METRICAS_CONFIG } from '../config.js';

/**
 * SensorStateManager
 * No guarda sensores (eso es trabajo de Ciudad); guarda la historia
 * reciente de eventos para poder calcular las métricas que pide el
 * documento: throughput, latencia promedio y % de pérdida.
 *
 * "Pérdida" se calcula con el número de secuencia (`seq`) que cada
 * sensor incluye en su mensaje: si el seq recibido salta (ej. de 5
 * a 8), se asume que los mensajes 6 y 7 se perdieron en el camino.
 * Es una medida real basada en lo que efectivamente llega por MQTT,
 * no una estimación teórica.
 */
export class SensorStateManager {
  constructor(ciudad) {
    this.ciudad = ciudad;

    this._timestampsRecientes = []; // para mensajes/seg
    this._latenciasRecientes = [];  // ms, para latencia promedio

    this._ultimoSeqPorSensor = new Map(); // sensor_id -> último seq visto
    this._mensajesRecibidosTotal = 0;
    this._mensajesPerdidosTotal = 0;
  }

  /**
   * Se llama cada vez que llega un mensaje MQTT ya aplicado a la Ciudad.
   * @param {object} payload - el mensaje crudo tal como llegó
   */
  registrarMensaje(payload) {
    const ahora = Date.now();
    this._timestampsRecientes.push(ahora);
    this._mensajesRecibidosTotal += 1;

    if (payload.timestamp) {
      // timestamp del doc viene en segundos epoch (ver ejemplo del proyecto)
      const emitidoMs = payload.timestamp > 1e12 ? payload.timestamp : payload.timestamp * 1000;
      const latencia = ahora - emitidoMs;
      if (latencia >= 0) this._latenciasRecientes.push(latencia);
    }

    if (typeof payload.seq === 'number' && payload.sensor_id) {
      const anterior = this._ultimoSeqPorSensor.get(payload.sensor_id);
      if (anterior !== undefined && payload.seq > anterior + 1) {
        this._mensajesPerdidosTotal += payload.seq - anterior - 1;
      }
      if (anterior === undefined || payload.seq > anterior) {
        this._ultimoSeqPorSensor.set(payload.sensor_id, payload.seq);
      }
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

    const esperadosTotal = this._mensajesRecibidosTotal + this._mensajesPerdidosTotal;
    const perdida = esperadosTotal > 0
      ? (this._mensajesPerdidosTotal / esperadosTotal) * 100
      : 0;

    return {
      totalSensores,
      activos,
      inactivos: totalSensores - activos,
      mensajesPorSeg,
      latenciaPromedioMs: Math.round(latenciaProm),
      perdidaPct: Number(perdida.toFixed(2)),
      mensajesPerdidosTotal: this._mensajesPerdidosTotal,
    };
  }
}
