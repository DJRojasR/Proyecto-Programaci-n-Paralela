/**
 * GraficoExperimentos
 * Dibuja, en SVG puro, throughput vs. trabajadores y speedup medido
 * vs. ideal — el equivalente visual de scripts/analizar_speedup.py,
 * pero directo en el navegador, sin instalar nada.
 */

function escalar(valor, dominioMin, dominioMax, rangoMin, rangoMax) {
    if (dominioMax === dominioMin) return (rangoMin + rangoMax) / 2;
    return rangoMin + ((valor - dominioMin) / (dominioMax - dominioMin)) * (rangoMax - rangoMin);
}

function construirEjeYLabels(maxValor) {
    const pasos = 4;
    const labels = [];
    for (let i = 0; i <= pasos; i++) {
        labels.push(Number(((maxValor / pasos) * i).toFixed(1)));
    }
    return labels;
}

function dibujarLinea(puntos, color, ancho = 2, punteada = false) {
    const path = puntos.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    const dash = punteada ? 'stroke-dasharray="6 4"' : '';
    return `<path d="${path}" fill="none" stroke="${color}" stroke-width="${ancho}" ${dash} />`;
}

function dibujarPuntos(puntos, color) {
    return puntos.map((p) => `<circle cx="${p.x}" cy="${p.y}" r="3.5" fill="${color}" />`).join('');
}

function graficaIndividual({ titulo, trabajadores, serieA, serieB, colorA, colorB, labelA, labelB, unidadY }) {
    const W = 380, H = 220;
    const margen = { top: 24, right: 16, bottom: 32, left: 40 };
    const anchoUtil = W - margen.left - margen.right;
    const altoUtil = H - margen.top - margen.bottom;

    const maxY = Math.max(...serieA, ...(serieB || [0])) * 1.15 || 1;
    const minX = Math.min(...trabajadores);
    const maxX = Math.max(...trabajadores);

    const puntosA = trabajadores.map((t, i) => ({
        x: margen.left + escalar(t, minX, maxX, 0, anchoUtil),
        y: margen.top + altoUtil - escalar(serieA[i], 0, maxY, 0, altoUtil),
    }));

    const puntosB = serieB
        ? trabajadores.map((t, i) => ({
            x: margen.left + escalar(t, minX, maxX, 0, anchoUtil),
            y: margen.top + altoUtil - escalar(serieB[i], 0, maxY, 0, altoUtil),
        }))
        : null;

    const ejeYLabels = construirEjeYLabels(maxY);

    return `
    <div class="grafico-experimento">
      <div class="grafico-experimento__titulo">${titulo}</div>
      <svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}">
        <!-- líneas guía horizontales -->
        ${ejeYLabels.map((v) => {
            const y = margen.top + altoUtil - escalar(v, 0, maxY, 0, altoUtil);
            return `<line x1="${margen.left}" y1="${y}" x2="${W - margen.right}" y2="${y}"
                          stroke="var(--line-hairline)" stroke-width="1" />
                    <text x="${margen.left - 6}" y="${y + 3}" text-anchor="end"
                          font-size="9" fill="var(--text-faint)">${v}${unidadY}</text>`;
        }).join('')}

        <!-- eje X -->
        ${trabajadores.map((t) => {
            const x = margen.left + escalar(t, minX, maxX, 0, anchoUtil);
            return `<text x="${x}" y="${H - 10}" text-anchor="middle"
                          font-size="9" fill="var(--text-faint)">${t}</text>`;
        }).join('')}
        <text x="${W / 2}" y="${H - 1}" text-anchor="middle" font-size="9"
              fill="var(--text-dim)">trabajadores (procesos × hilos)</text>

        ${puntosB ? dibujarLinea(puntosB, colorB, 1.5, true) : ''}
        ${dibujarLinea(puntosA, colorA)}
        ${dibujarPuntos(puntosA, colorA)}
        ${puntosB ? dibujarPuntos(puntosB, colorB) : ''}
      </svg>
      <div class="grafico-experimento__leyenda">
        <span><i style="background:${colorA}"></i>${labelA}</span>
        ${labelB ? `<span><i style="background:${colorB}"></i>${labelB}</span>` : ''}
      </div>
    </div>
  `;
}

export function renderGraficos(contenedor, resultados) {
    const trabajadores = resultados.map((r) => r.trabajadores);
    const throughput = resultados.map((r) => r.throughput);
    const speedup = resultados.map((r) => r.speedup);
    const speedupIdeal = trabajadores.map((t) => t / trabajadores[0]);

    contenedor.innerHTML = `
    <div class="graficos-grid">
      ${graficaIndividual({
          titulo: 'Throughput real vs. paralelismo',
          trabajadores, serieA: throughput, serieB: null,
          colorA: 'var(--signal-active)', colorB: null,
          labelA: 'msgs/seg', labelB: null, unidadY: '',
      })}
      ${graficaIndividual({
          titulo: 'Speedup medido vs. ideal',
          trabajadores, serieA: speedup, serieB: speedupIdeal,
          colorA: 'var(--signal-active)', colorB: 'var(--text-faint)',
          labelA: 'Speedup medido', labelB: 'Speedup ideal (lineal)', unidadY: 'x',
      })}
    </div>
  `;
}

export function renderTabla(contenedor, resultados) {
    const filas = resultados.map((r) => `
    <tr>
      <td>${r.procesos}</td>
      <td>${r.hilos}</td>
      <td>${r.trabajadores}</td>
      <td>${r.throughput.toFixed(1)}</td>
      <td>${r.speedup.toFixed(2)}x</td>
      <td>${r.eficiencia.toFixed(2)}</td>
    </tr>
  `).join('');

    contenedor.innerHTML = `
    <table class="tabla-experimentos">
      <thead>
        <tr>
          <th>Procesos</th><th>Hilos</th><th>Trabaj.</th>
          <th>Msgs/seg</th><th>Speedup</th><th>Eficiencia</th>
        </tr>
      </thead>
      <tbody>${filas}</tbody>
    </table>
  `;
}
