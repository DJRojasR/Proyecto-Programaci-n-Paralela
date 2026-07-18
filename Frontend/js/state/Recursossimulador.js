/**
 * RecursosSimulador
 * Recibe los heartbeats de CPU/memoria que cada proceso MPI publica
 * en el tópico de control (ver monitor.c del lado del simulador) y
 * los agrega en un resumen: memoria total (suma de todos los
 * procesos) y CPU promedio. Un proceso "activo" es uno del que se
 * escuchó un heartbeat hace poco; si deja de reportar, se asume que
 * el proceso terminó y ya no cuenta.
 */

const TIMEOUT_PROCESO_MS = 6000; // sin heartbeat en 6s -> se considera caído

export class RecursosSimulador {
  constructor() {
    /** @type {Map<number, {cpuPct:number, memKb:number, mensajes:number, ultimaVez:number}>} */
    this._porRank = new Map();
  }

  registrarHeartbeat(payload) {
    this._porRank.set(payload.rank, {
      cpuPct: payload.cpu_pct ?? 0,
      memKb: payload.mem_kb ?? 0,
      mensajes: payload.mensajes_publicados ?? 0,
      ultimaVez: Date.now(),
    });
  }

  resumen() {
    const ahora = Date.now();
    let memTotalKb = 0;
    let cpuSuma = 0;
    let procesosActivos = 0;

    for (const datos of this._porRank.values()) {
      if (ahora - datos.ultimaVez > TIMEOUT_PROCESO_MS) continue; // proceso caído/terminado
      memTotalKb += datos.memKb;
      cpuSuma += datos.cpuPct;
      procesosActivos++;
    }

    return {
      procesosActivos,
      memoriaTotalMb: memTotalKb / 1024,
      cpuPromedioPct: procesosActivos ? cpuSuma / procesosActivos : 0,
    };
  }
}