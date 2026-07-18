/**
 * ZonasPanel
 * Muestra cuántos sensores hay activos en cada zona geográfica
 * (Norte/Sur/Este/Oeste, o sus subzonas si el simulador corre con
 * 8 procesos). Es una lectura directa de Ciudad.contarPorZona(),
 * sin lógica propia.
 */
export class ZonasPanel {
  constructor(containerEl) {
    this.containerEl = containerEl;
  }

  actualizar(conteoPorZona) {
    const entradas = Object.entries(conteoPorZona).sort((a, b) => b[1] - a[1]);

    if (entradas.length === 0) {
      this.containerEl.innerHTML = `<div class="zona-row zona-row--vacio">Sin datos todavía</div>`;
      return;
    }

    this.containerEl.innerHTML = entradas
      .map(([zona, cantidad]) => `
        <div class="zona-row">
          <span class="zona-row__nombre">${zona}</span>
          <span class="zona-row__valor">${cantidad}</span>
        </div>
      `)
      .join('');
  }
}
