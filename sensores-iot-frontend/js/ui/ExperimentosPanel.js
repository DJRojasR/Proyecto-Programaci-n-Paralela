import { parsearCSV } from '../experimentos/CsvParser.js';
import { calcularMetricas } from '../experimentos/CalculoSpeedup.js';
import { renderGraficos, renderTabla } from '../experimentos/GraficoExperimentos.js';
import { RegistroExperimentos } from '../experimentos/RegistroExperimentos.js';

/**
 * ExperimentosPanel
 * Dos formas de armar la gráfica de rendimiento, sin salir del navegador:
 *
 * 1) EN VIVO (recomendada, sin archivos): mientras estás conectado al
 *    broker y corriendo una configuración en la terminal, escribes
 *    cuántos procesos/hilos usaste ahí y le das "Registrar punto" —
 *    toma el throughput que YA se está midiendo en vivo
 *    (SensorStateManager) y lo guarda. Repites con otra configuración
 *    y le das "Ver gráfica": arma tabla + gráficas con lo registrado.
 *
 * 2) CSV (opcional): si ya corriste scripts/medir_speedup.sh y tienes
 *    el archivo, lo puedes cargar igual para verlo aquí.
 */
export class ExperimentosPanel {
  constructor({ triggerContainerEl, modalEl, obtenerThroughputActual }) {
    this.triggerContainerEl = triggerContainerEl;
    this.modalEl = modalEl;
    this.obtenerThroughputActual = obtenerThroughputActual;
    this.registro = new RegistroExperimentos();
  }

  render() {
    this.triggerContainerEl.innerHTML = `
      <div class="control-field">
        <label for="input-exp-procesos">Procesos MPI usados ahora</label>
        <input id="input-exp-procesos" type="number" min="1" value="1" />
      </div>
      <div class="control-field">
        <label for="input-exp-hilos">Hilos por proceso usados ahora</label>
        <input id="input-exp-hilos" type="number" min="1" value="1" />
      </div>
      <button class="btn-primary" id="btn-registrar-punto">Registrar punto con rendimiento actual</button>

      <div class="experimentos-resumen" id="experimentos-resumen">0 puntos registrados</div>

      <button class="btn-primary" id="btn-ver-grafica" disabled>Ver gráfica de rendimiento</button>

      <div class="experimentos-separador">o, si ya tienes un CSV de <code>medir_speedup.sh</code>:</div>
      <input type="file" id="input-csv-experimentos" accept=".csv" style="display:none" />
      <button class="btn-secundario" id="btn-cargar-csv">Cargar CSV</button>
    `;

    this.triggerContainerEl.querySelector('#btn-registrar-punto')
      .addEventListener('click', () => this._registrarPunto());

    this.triggerContainerEl.querySelector('#btn-ver-grafica')
      .addEventListener('click', () => this._mostrarDesdeRegistro());

    const inputCsv = this.triggerContainerEl.querySelector('#input-csv-experimentos');
    this.triggerContainerEl.querySelector('#btn-cargar-csv')
      .addEventListener('click', () => inputCsv.click());
    inputCsv.addEventListener('change', (ev) => this._manejarArchivoCSV(ev));
  }

  _registrarPunto() {
    const procesos = Number(this.triggerContainerEl.querySelector('#input-exp-procesos').value) || 1;
    const hilos = Number(this.triggerContainerEl.querySelector('#input-exp-hilos').value) || 1;
    const throughputMsgsSeg = this.obtenerThroughputActual();

    if (!throughputMsgsSeg) {
      alert('El throughput en vivo está en 0. Conéctate al broker y espera a que lleguen mensajes antes de registrar.');
      return;
    }

    this.registro.registrar({ procesos, hilos, throughputMsgsSeg });
    this._actualizarResumen();
  }

  _actualizarResumen() {
    const n = this.registro.cantidad();
    this.triggerContainerEl.querySelector('#experimentos-resumen').textContent =
      `${n} punto${n === 1 ? '' : 's'} registrado${n === 1 ? '' : 's'}`;
    this.triggerContainerEl.querySelector('#btn-ver-grafica').disabled = n < 2;
  }

  _mostrarDesdeRegistro() {
    const filas = this.registro.listar();
    const { resultados } = calcularMetricas(filas);
    this._mostrarModal(resultados);
  }

  _manejarArchivoCSV(evento) {
    const archivo = evento.target.files[0];
    if (!archivo) return;

    const lector = new FileReader();
    lector.onload = () => {
      try {
        const filas = parsearCSV(lector.result);
        const { resultados } = calcularMetricas(filas);
        this._mostrarModal(resultados);
      } catch (err) {
        alert('No se pudo leer el CSV. ¿Es el archivo que genera medir_speedup.sh?');
        console.error(err);
      }
    };
    lector.readAsText(archivo);
  }

  _mostrarModal(resultados) {
    this.modalEl.innerHTML = `
      <div class="modal-experimentos__overlay">
        <div class="modal-experimentos__caja">
          <div class="modal-experimentos__header">
            <span>Resultados de experimentos — Speedup y Eficiencia</span>
            <button id="btn-cerrar-experimentos" class="modal-experimentos__cerrar">✕</button>
          </div>
          <div id="tabla-experimentos-container"></div>
          <div id="graficos-experimentos-container"></div>
        </div>
      </div>
    `;

    renderTabla(this.modalEl.querySelector('#tabla-experimentos-container'), resultados);
    renderGraficos(this.modalEl.querySelector('#graficos-experimentos-container'), resultados);

    this.modalEl.style.display = 'block';
    this.modalEl.querySelector('#btn-cerrar-experimentos').addEventListener('click', () => {
      this.modalEl.style.display = 'none';
      this.modalEl.innerHTML = '';
    });
  }
}
