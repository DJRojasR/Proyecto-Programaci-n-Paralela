/**
 * CsvParser
 * Parser mínimo para el CSV que produce medir_speedup.sh
 * (procesos,hilos,sensores,duracion_seg,mensajes,throughput_msgs_seg).
 * No es un parser CSV genérico (no maneja comillas ni comas escapadas):
 * es justo lo que necesitamos para este formato simple y fijo.
 */
export function parsearCSV(texto) {
    const lineas = texto.trim().split('\n').filter((l) => l.trim().length > 0);
    if (lineas.length < 2) return [];

    const encabezados = lineas[0].split(',').map((h) => h.trim());
    return lineas.slice(1).map((linea) => {
        const valores = linea.split(',').map((v) => v.trim());
        const fila = {};
        encabezados.forEach((h, i) => {
            const num = Number(valores[i]);
            fila[h] = Number.isNaN(num) ? valores[i] : num;
        });
        return fila;
    });
}
