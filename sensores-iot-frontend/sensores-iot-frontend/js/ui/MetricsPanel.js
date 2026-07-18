/**
 * MetricsPanel
 * Pinta las tarjetas de métricas (total, activos, msgs/seg, latencia,
 * pérdida) tanto en la topbar como en la sidebar. Solo toca el DOM;
 * los números se los pasa quien lo llame (main.js).
 */
export class MetricsPanel {
  constructor({ topbarEl, sidebarEl }) {
    this.topbarEl = topbarEl;
    this.sidebarEl = sidebarEl;
  }

  actualizar(metricas) {
    this._actualizarTopbar(metricas);
    this._actualizarSidebar(metricas);
  }

  _actualizarTopbar(m) {
    this._setValor(this.topbarEl, 'total', m.totalSensores);
    this._setValor(this.topbarEl, 'activos', m.activos, 'active');
    this._setValor(this.topbarEl, 'msgs-seg', m.mensajesPorSeg);
    this._setValor(this.topbarEl, 'latencia', `${m.latenciaPromedioMs} ms`,
      m.latenciaPromedioMs > 200 ? 'warn' : null);
  }

  _actualizarSidebar(m) {
    this._setValor(this.sidebarEl, 'card-total', m.totalSensores);
    this._setValor(this.sidebarEl, 'card-activos', m.activos);
    this._setValor(this.sidebarEl, 'card-inactivos', m.inactivos);
    this._setValor(this.sidebarEl, 'card-msgs-seg', m.mensajesPorSeg);
    this._setValor(this.sidebarEl, 'card-latencia', m.latenciaPromedioMs);
    this._setValor(
      this.sidebarEl,
      'card-perdida',
      m.perdidaPct,
      m.perdidaPct > 5 ? 'crit' : null
    );
  }

  _setValor(root, dataKey, valor, tono = null) {
    const el = root.querySelector(`[data-metric="${dataKey}"]`);
    if (!el) return;
    el.textContent = valor;
    if (tono) el.dataset.tone = tono;
    else delete el.dataset.tone;
  }

  /**
   * Pinta el mejor resultado (mayor número de trabajadores) del último
   * CSV de experimentos cargado, como dos tarjetas más junto al resto
   * de métricas — no es una métrica en vivo, es del último análisis.
   */
  actualizarExperimento({ speedup, eficiencia }) {
    this._setValor(this.sidebarEl, 'card-speedup', `${speedup.toFixed(2)}x`);
    this._setValor(
      this.sidebarEl,
      'card-eficiencia',
      eficiencia.toFixed(2),
      eficiencia < 0.5 ? 'warn' : null
    );
  }
}
