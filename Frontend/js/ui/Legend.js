/**
 * Legend
 * Componente estático: dibuja una sola vez el significado de cada
 * color en el mapa. No tiene estado propio.
 */
export class Legend {
  constructor(containerEl) {
    this.containerEl = containerEl;
  }

  render() {
    this.containerEl.innerHTML = `
      <div class="legend-row">
        <span class="legend-dot legend-dot--active"></span>
        <span>Sensor activo (transmitió hace &lt; 3 s)</span>
      </div>
      <div class="legend-row">
        <span class="legend-dot legend-dot--idle"></span>
        <span>Sensor inactivo</span>
      </div>
    `;
  }
}
