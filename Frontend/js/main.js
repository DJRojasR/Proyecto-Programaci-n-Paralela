import { Ciudad } from './models/Ciudad.js';
import { MQTTClient } from './mqtt/MQTTClient.js';
import { WebGLRenderer } from './render/WebGLRenderer.js';
import { SensorStateManager } from './state/SensorStateManager.js';
import { MetricsPanel } from './ui/MetricsPanel.js';
import { Legend } from './ui/Legend.js';
import { ControlPanel } from './ui/ControlPanel.js';
import { METRICAS_CONFIG } from './config.js';

// --- Modelos y estado -------------------------------------------------
const ciudad = new Ciudad();
const stateManager = new SensorStateManager(ciudad);
let mqttClient = null;

// --- Referencias al DOM ------------------------------------------------
const canvas = document.getElementById('sensor-canvas');
const emptyState = document.querySelector('.map-empty-state');
const connectionPill = document.getElementById('connection-pill');

const metricsPanel = new MetricsPanel({
  topbarEl: document.getElementById('topbar-metrics'),
  sidebarEl: document.getElementById('sidebar-metrics'),
});

const legend = new Legend(document.getElementById('legend-container'));
legend.render();

const controlPanel = new ControlPanel(document.getElementById('control-container'));
controlPanel.render();

// --- Renderer WebGL ------------------------------------------------
const renderer = new WebGLRenderer(canvas);
renderer.iniciarLoop(() => ciudad.listar());

// --- Ciclo de métricas (independiente del framerate del render) ----
setInterval(() => {
  metricsPanel.actualizar(stateManager.calcularMetricas());
}, METRICAS_CONFIG.intervaloRefrescoMs);

// --- Conexión MQTT bajo demanda -------------------------------------
controlPanel.onConectar(({ brokerUrl, topic }) => {
  if (mqttClient) mqttClient.desconectar();

  mqttClient = new MQTTClient({ brokerUrl, topic });

  mqttClient.on('connect', () => {
    connectionPill.dataset.state = 'connected';
    connectionPill.querySelector('span').textContent = 'Conectado';
    emptyState.style.display = 'none';
    controlPanel.marcarEstadoBoton('Conectado', true);
  });

  mqttClient.on('message', (payload) => {
    ciudad.aplicarMedicion(payload);
    stateManager.registrarMensaje(payload);
  });

  mqttClient.on('error', (err) => {
    connectionPill.dataset.state = 'error';
    connectionPill.querySelector('span').textContent = 'Error de conexión';
    controlPanel.marcarEstadoBoton('Reintentar', false);
    console.error('[MQTT]', err);
  });

  mqttClient.on('close', () => {
    connectionPill.dataset.state = 'idle';
    connectionPill.querySelector('span').textContent = 'Desconectado';
    controlPanel.marcarEstadoBoton('Conectar', false);
  });

  controlPanel.marcarEstadoBoton('Conectando...', true);
  mqttClient.conectar();
});