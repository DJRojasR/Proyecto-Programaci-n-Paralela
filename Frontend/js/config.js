/**
 * config.js
 * Constantes centrales del proyecto. Nada de lógica aquí:
 * si algo cambia (topic, broker, umbrales), cambia solo en este archivo.
 */

export const MQTT_CONFIG = {
  // URL de un broker con soporte WebSocket (ej. Mosquitto con listener 9001/ws)
  brokerUrl: 'ws://localhost:9001',
  topic: 'ciudad/sensores/medicion',
  clientIdPrefix: 'colector-web-',
};

export const CIUDAD_CONFIG = {
  // Espacio de coordenadas lógico de la ciudad (no píxeles de pantalla)
  ancho: 1000,
  alto: 1000,
  zonas: ['Norte', 'Sur', 'Este', 'Oeste'],
};

export const SENSOR_ESTADOS = {
  ACTIVO: 'activo',     // acaba de transmitir -> verde
  INACTIVO: 'inactivo', // sin transmitir recientemente -> gris
  DESCONECTADO: 'desconectado',
};

export const VISUAL_CONFIG = {
  // Tiempo que un sensor se mantiene "verde" tras transmitir
  msActivo: 3000,
  colorActivo: [0.22, 1.0, 0.62],   // #39ff9d en RGB [0-1]
  colorInactivo: [0.23, 0.27, 0.32], // #3a4552
  radioPuntoPx: 3,
};

export const METRICAS_CONFIG = {
  // Ventana deslizante para calcular mensajes/seg
  ventanaThroughputMs: 1000,
  // Cada cuánto se refresca el panel de métricas en pantalla
  intervaloRefrescoMs: 500,
};

export const SIMULACION_CONFIG = {
  // Valores por defecto del generador de datos ficticios (sin MPI,
  // solo para poder ver la interfaz funcionando localmente).
  cantidadSensoresDefault: 2000,
  intervaloEmisionMs: 300,   // cada cuánto se emite un lote de mensajes
  mensajesPorLote: 150,      // cuántos sensores "transmiten" por lote
  temperaturaRango: [15, 34],
  humedadRango: [30, 90],
};
