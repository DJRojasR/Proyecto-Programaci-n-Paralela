/**
 * calcularMetricas
 * Misma lógica que scripts/analizar_speedup.py, en JS: toma las filas
 * del CSV (procesos, hilos, throughput_msgs_seg) y calcula, contra la
 * configuración con menos trabajadores, el speedup y la eficiencia.
 */
export function calcularMetricas(filas) {
    if (!filas.length) return { base: null, resultados: [] };

    const base = filas.reduce((min, f) =>
        f.procesos * f.hilos < min.procesos * min.hilos ? f : min
    );
    const throughputBase = base.throughput_msgs_seg || 1e-9;

    const resultados = filas
        .map((f) => {
            const trabajadores = f.procesos * f.hilos;
            const speedup = f.throughput_msgs_seg / throughputBase;
            return {
                procesos: f.procesos,
                hilos: f.hilos,
                trabajadores,
                throughput: f.throughput_msgs_seg,
                speedup,
                eficiencia: trabajadores ? speedup / trabajadores : 0,
            };
        })
        .sort((a, b) => a.trabajadores - b.trabajadores);

    return { base, throughputBase, resultados };
}
