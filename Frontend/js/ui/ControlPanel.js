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


