import { Ciudad } from './models/Ciudad.js';
import { MQTTClient } from './mqtt/MQTTClient.js';
import { WebGLRenderer } from './render/WebGLRenderer.js';
import { SensorStateManager } from './state/SensorStateManager.js';
import { RecursosSimulador } from './state/RecursosSimulador.js';
import { MetricsPanel } from './ui/MetricsPanel.js';
import { Legend } from './ui/Legend.js';
import { ZonasPanel } from './ui/ZonasPanel.js';
import { ControlPanel } from './ui/ControlPanel.js';
import { ExperimentosPanel } from './ui/ExperimentosPanel.js';
import { METRICAS_CONFIG, MQTT_CONFIG } from './config.js';

// --- Modelos y estado -------------------------------------------------
const ciudad = new Ciudad();
const stateManager = new SensorStateManager(ciudad);
const recursosSimulador = new RecursosSimulador();
let mqttClient = null;

// --- Referencias al DOM ------------------------------------------------
const canvas = document.getElementById('sensor-canvas');
const emptyState = document.querySelector('.map-empty-state');
const connectionPill = document.getElementById('connection-pill');
const statusBar = document.querySelector('.status-bar');

const metricsPanel = new MetricsPanel({
  topbarEl: document.getElementById('topbar-metrics'),
  sidebarEl: document.getElementById('sidebar-metrics'),
});

const legend = new Legend(document.getElementById('legend-container'));
legend.render();

const zonasPanel = new ZonasPanel(document.getElementById('zonas-container'));
zonasPanel.actualizar({});

const controlPanel = new ControlPanel(document.getElementById('control-container'));
controlPanel.render();

const experimentosPanel = new ExperimentosPanel({
  triggerContainerEl: document.getElementById('experimentos-container'),
  modalEl: document.getElementById('modal-experimentos'),
  obtenerThroughputActual: () => stateManager.calcularMetricas().mensajesPorSeg,
});
experimentosPanel.render();

// --- Renderer WebGL ------------------------------------------------
const renderer = new WebGLRenderer(canvas);
renderer.iniciarLoop(() => ciudad.listar());

// --- Ciclo de métricas (independiente del framerate del render) ----
setInterval(() => {
  metricsPanel.actualizar(stateManager.calcularMetricas());
  zonasPanel.actualizar(ciudad.contarPorZona());
  actualizarStatusBar();
}, METRICAS_CONFIG.intervaloRefrescoMs);

function actualizarStatusBar() {
  const { procesosActivos, memoriaTotalMb, cpuPromedioPct } = recursosSimulador.resumen();

  statusBar.querySelector('[data-status="cpu"]').textContent =
    procesosActivos > 0 ? `${cpuPromedioPct.toFixed(1)}%` : '—';
  statusBar.querySelector('[data-status="memoria"]').textContent =
    procesosActivos > 0 ? `${memoriaTotalMb.toFixed(1)} MB` : '—';
  statusBar.querySelector('[data-status="procesos"]').textContent = procesosActivos;

  // Memoria que está usando el propio navegador (solo disponible en Chrome/Edge).
  const memEl = statusBar.querySelector('[data-status="memoria-navegador"]');
  if (performance.memory) {
    const usadaMb = performance.memory.usedJSHeapSize / (1024 * 1024);
    memEl.textContent = `${usadaMb.toFixed(1)} MB`;
  } else {
    memEl.textContent = 'no disponible';
  }
}

// --- Conexión MQTT bajo demanda -------------------------------------
controlPanel.onConectar(({ brokerUrl, topic }) => {
  if (mqttClient) mqttClient.desconectar();

  mqttClient = new MQTTClient({ brokerUrl, topic, topicControl: MQTT_CONFIG.topicControl });

  mqttClient.on('connect', () => {
    connectionPill.dataset.state = 'connected';
    connectionPill.querySelector('span').textContent = 'Conectado';
    emptyState.style.display = 'none';
    controlPanel.marcarEstadoBoton('Conectado', true);
  });

  // Cada mensaje llega etiquetado con su tópico: los de sensores
  // alimentan la Ciudad/métricas, los de control alimentan el
  // resumen de CPU/memoria del simulador (status bar).
  mqttClient.on('message', ({ topic: topicRecibido, payload }) => {
    if (topicRecibido === MQTT_CONFIG.topicControl) {
      recursosSimulador.registrarHeartbeat(payload);
      return;
    }
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