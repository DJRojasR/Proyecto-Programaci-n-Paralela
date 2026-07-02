import { Sensor } from './Sensor.js';

/**
 * Ciudad
 * Colección de todos los sensores conocidos por la interfaz.
 * No genera datos: solo registra, busca y agrega lo que le llega
 * (hoy desde MQTT real, en el futuro también podría venir de un
 * proceso MPI/colector, sin que este modelo cambie).
 */
export class Ciudad {
  constructor() {
    /** @type {Map<string, Sensor>} */
    this.sensores = new Map();
  }

  /**
   * Devuelve el sensor con ese id, creándolo si es la primera vez
   * que se ve (alta "lazy": no hace falta un registro previo).
   */
  obtenerOCrear(id, { x, y, zona } = {}) {
    let sensor = this.sensores.get(id);
    if (!sensor) {
      sensor = new Sensor({ id, x: x ?? 0, y: y ?? 0, zona });
      this.sensores.set(id, sensor);
    }
    return sensor;
  }

  aplicarMedicion(payload) {
    const { sensor_id, x, y, temperature, humidity, timestamp } = payload;
    const sensor = this.obtenerOCrear(sensor_id, { x, y });
    sensor.actualizar({ temperatura: temperature, humedad: humidity, timestamp });
    return sensor;
  }

  listar() {
    return Array.from(this.sensores.values());
  }

  contarActivos() {
    let n = 0;
    for (const s of this.sensores.values()) if (s.estaActivo()) n++;
    return n;
  }

  total() {
    return this.sensores.size;
  }

  porZona(zona) {
    return this.listar().filter((s) => s.zona === zona);
  }
}
