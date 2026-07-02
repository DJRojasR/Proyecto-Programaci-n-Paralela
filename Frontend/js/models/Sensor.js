import { SENSOR_ESTADOS, VISUAL_CONFIG } from '../config.js';

/**
 * Sensor
 * Representa un único sensor IoT de la ciudad. Es un modelo puro:
 * no sabe de MQTT ni de WebGL, solo guarda su propio estado.
 *
 * Campos según el documento del proyecto (sección 3):
 *   id, x, y, temperatura, humedad, timestamp, estado de conexión,
 *   frecuencia de transmisión.
 */
export class Sensor {
  constructor({ id, x, y, zona = null, frecuencia = 10 }) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.zona = zona;
    this.frecuencia = frecuencia; // segundos entre publicaciones

    this.temperatura = null;
    this.humedad = null;
    this.timestamp = null;

    this.estado = SENSOR_ESTADOS.DESCONECTADO;

    this._fadeTimeoutId = null;
  }

  /**
   * Aplica una medición nueva (típicamente venida de un mensaje MQTT).
   * Marca el sensor como activo y programa su vuelta a inactivo.
   */
  actualizar({ temperatura, humedad, timestamp }) {
    this.temperatura = temperatura;
    this.humedad = humedad;
    this.timestamp = timestamp ?? Date.now();
    this.estado = SENSOR_ESTADOS.ACTIVO;

    if (this._fadeTimeoutId) clearTimeout(this._fadeTimeoutId);
    this._fadeTimeoutId = setTimeout(() => {
      this.estado = SENSOR_ESTADOS.INACTIVO;
      this._fadeTimeoutId = null;
    }, VISUAL_CONFIG.msActivo);
  }

  marcarDesconectado() {
    if (this._fadeTimeoutId) clearTimeout(this._fadeTimeoutId);
    this.estado = SENSOR_ESTADOS.DESCONECTADO;
  }

  estaActivo() {
    return this.estado === SENSOR_ESTADOS.ACTIVO;
  }

  toJSON() {
    return {
      id: this.id,
      x: this.x,
      y: this.y,
      zona: this.zona,
      temperatura: this.temperatura,
      humedad: this.humedad,
      timestamp: this.timestamp,
      estado: this.estado,
      frecuencia: this.frecuencia,
    };
  }
}
