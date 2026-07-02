import { MQTT_CONFIG } from '../config.js';

/**
 * ControlPanel
 * Formulario mínimo para apuntar a un broker y conectar/desconectar.
 * No sabe hablar MQTT: solo emite 'conectar' / 'desconectar' con los
 * datos del formulario, y quien lo escuche (main.js) decide qué hacer.
 */
export class ControlPanel {
  constructor(containerEl) {
    this.containerEl = containerEl;
    this._onConectar = null;
    this._onDesconectar = null;
  }

  render() {
    this.containerEl.innerHTML = `
      <div class="control-field">
        <label for="input-broker">Broker (WebSocket)</label>
        <input id="input-broker" type="text" value="${MQTT_CONFIG.brokerUrl}" />
      </div>
      <div class="control-field">
        <label for="input-topic">Tópico</label>
        <input id="input-topic" type="text" value="${MQTT_CONFIG.topic}" />
      </div>
      <button class="btn-primary" id="btn-conectar">Conectar</button>
    `;

    this.containerEl.querySelector('#btn-conectar').addEventListener('click', () => {
      const brokerUrl = this.containerEl.querySelector('#input-broker').value.trim();
      const topic = this.containerEl.querySelector('#input-topic').value.trim();
      if (this._onConectar) this._onConectar({ brokerUrl, topic });
    });
  }

  onConectar(callback) {
    this._onConectar = callback;
  }

  marcarEstadoBoton(texto, deshabilitado = false) {
    const btn = this.containerEl.querySelector('#btn-conectar');
    if (!btn) return;
    btn.textContent = texto;
    btn.disabled = deshabilitado;
  }
}

/**
 * SimulacionPanel
 * Bloque separado del de conexión MQTT real: deja iniciar/detener el
 * SimuladorSensores con una cantidad configurable de sensores, para
 * probar el render y las métricas sin depender de un broker.
 */
export class SimulacionPanel {
  constructor(containerEl, cantidadDefault) {
    this.containerEl = containerEl;
    this.cantidadDefault = cantidadDefault;
    this._onIniciar = null;
    this._onDetener = null;
  }

  render() {
    this.containerEl.innerHTML = `
      <div class="control-field">
        <label for="input-cantidad">Sensores ficticios</label>
        <input id="input-cantidad" type="number" min="1" max="1000000" value="${this.cantidadDefault}" />
      </div>
      <button class="btn-primary" id="btn-simular">Generar datos ficticios</button>
    `;

    this.containerEl.querySelector('#btn-simular').addEventListener('click', () => {
      const btn = this.containerEl.querySelector('#btn-simular');
      const cantidad = Number(this.containerEl.querySelector('#input-cantidad').value) || this.cantidadDefault;

      if (btn.dataset.activo === 'true') {
        if (this._onDetener) this._onDetener();
        btn.dataset.activo = 'false';
        btn.textContent = 'Generar datos ficticios';
      } else {
        if (this._onIniciar) this._onIniciar({ cantidad });
        btn.dataset.activo = 'true';
        btn.textContent = 'Detener simulación';
      }
    });
  }

  onIniciar(callback) {
    this._onIniciar = callback;
  }

  onDetener(callback) {
    this._onDetener = callback;
  }
}
