import { MQTT_CONFIG } from '../config.js';

/**
 * MQTTClient
 * Envoltorio delgado sobre la librería mqtt.js (cargada por CDN como
 * variable global `mqtt` en index.html). Su única responsabilidad es
 * conectarse, suscribirse al tópico de la ciudad y reenviar cada
 * mensaje ya parseado. No decide qué hacer con los datos: eso lo
 * hace quien lo escuche (ver main.js).
 *
 * No se autoconecta al importarse: la conexión la dispara el usuario
 * desde el panel de control, o main.js si se decide automatizarlo.
 */
export class MQTTClient {
  constructor({ brokerUrl = MQTT_CONFIG.brokerUrl, topic = MQTT_CONFIG.topic } = {}) {
    this.brokerUrl = brokerUrl;
    this.topic = topic;
    this.client = null;

    this._listeners = {
      message: [],
      connect: [],
      error: [],
      close: [],
    };
  }

  on(evento, callback) {
    if (!this._listeners[evento]) {
      throw new Error(`Evento MQTT desconocido: ${evento}`);
    }
    this._listeners[evento].push(callback);
  }

  _emit(evento, payload) {
    for (const cb of this._listeners[evento]) cb(payload);
  }

  conectar() {
    if (typeof mqtt === 'undefined') {
      throw new Error(
        'La librería mqtt.js no está cargada. Verifica el <script> en index.html.'
      );
    }

    const clientId = MQTT_CONFIG.clientIdPrefix + Math.random().toString(16).slice(2, 8);
    this.client = mqtt.connect(this.brokerUrl, { clientId });

    this.client.on('connect', () => {
      this.client.subscribe(this.topic, (err) => {
        if (err) this._emit('error', err);
      });
      this._emit('connect', { brokerUrl: this.brokerUrl, topic: this.topic });
    });

    this.client.on('message', (_topic, mensaje) => {
      let payload;
      try {
        payload = JSON.parse(mensaje.toString());
      } catch (err) {
        this._emit('error', new Error('Mensaje MQTT no es JSON válido'));
        return;
      }
      this._emit('message', payload);
    });

    this.client.on('error', (err) => this._emit('error', err));
    this.client.on('close', () => this._emit('close'));
  }

  desconectar() {
    if (this.client) {
      this.client.end(true);
      this.client = null;
    }
  }
}
