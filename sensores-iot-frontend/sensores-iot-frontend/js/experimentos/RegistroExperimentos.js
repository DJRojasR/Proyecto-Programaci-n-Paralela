/**
 * RegistroExperimentos
 * Guarda, en memoria (mientras la pestaña esté abierta), los puntos
 * de rendimiento que el usuario va registrando manualmente mientras
 * prueba distintas configuraciones de procesos/hilos en la terminal.
 *
 * No hay archivo de por medio: cada "punto" es solo
 * { procesos, hilos, throughput_msgs_seg }, tomado del throughput
 * en vivo que ya calcula SensorStateManager.
 */
export class RegistroExperimentos {
  constructor() {
    this._puntos = [];
  }

  registrar({ procesos, hilos, throughputMsgsSeg }) {
    this._puntos.push({
      procesos,
      hilos,
      throughput_msgs_seg: throughputMsgsSeg,
    });
  }

  listar() {
    return [...this._puntos];
  }

  limpiar() {
    this._puntos = [];
  }

  cantidad() {
    return this._puntos.length;
  }
}
