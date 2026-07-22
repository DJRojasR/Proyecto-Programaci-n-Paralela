#!/bin/bash
# medir_speedup.sh (Opción A: trabajo fijo)
#
# Cada sensor publica exactamente $REPETICIONES mensajes y el programa
# termina solo. Se mide el tiempo real que tarda en completar ese
# trabajo fijo con cada combinación de procesos MPI / hilos, y con eso
# se calcula speedup = tiempo_secuencial / tiempo_paralelo.
#
# Esto evita el problema de medir "mensajes en una ventana de tiempo":
# si el broker no da abasto, la cola interna de MQTT crece sin límite
# (memoria/CPU disparados) y el número no refleja el paralelismo real.
# Con trabajo fijo, el trabajo total es el mismo siempre; lo que cambia
# es solo cuánto tarda en completarse.
#
# Uso:
#   ./scripts/medir_speedup.sh [sensores] [repeticiones] ["lista procesos"] ["lista hilos"]
#
# Ejemplo:
#   ./scripts/medir_speedup.sh 10000 20 "1 2 4" "1 2 4 8"
set -u

SENSORES=${1:-10000}
REPETICIONES=${2:-20}
PROCESOS_LIST=${3:-"1 2 4"}
HILOS_LIST=${4:-"1 2 4 8"}

SALIDA="resultados_speedup.csv"
mkdir -p logs_experimentos

echo "procesos,hilos,sensores,repeticiones,tiempo_seg,mensajes,throughput_msgs_seg" > "$SALIDA"

echo "=== Compilando ==="
make -s

for P in $PROCESOS_LIST; do
  for H in $HILOS_LIST; do
    echo ""
    echo "=== Probando: $P proceso(s) MPI x $H hilo(s) = $((P * H)) trabajadores | $SENSORES sensores x $REPETICIONES rep ==="
    pkill -9 -f bin/simulador 2>/dev/null
    sleep 1

    SIM_LOG="logs_experimentos/sim_p${P}_h${H}.log"

    # Sin timeout ni kill: el propio programa termina solo al
    # completar el trabajo fijo (--repeticiones).
    mpirun --allow-run-as-root --oversubscribe -np "$P" ./bin/simulador \
      --sensores "$SENSORES" --hilos "$H" --repeticiones "$REPETICIONES" > "$SIM_LOG" 2>&1

    LINEA=$(grep "^RESULTADO_FIJO," "$SIM_LOG")
    if [ -z "$LINEA" ]; then
      echo "  -> ERROR: no se encontró línea RESULTADO_FIJO en $SIM_LOG (revisa el log)"
      continue
    fi

    # RESULTADO_FIJO,procesos,hilos,sensores,repeticiones,tiempo,mensajes,throughput
    TIEMPO=$(echo "$LINEA" | cut -d',' -f6)
    MENSAJES=$(echo "$LINEA" | cut -d',' -f7)
    THROUGHPUT=$(echo "$LINEA" | cut -d',' -f8)

    echo "  -> $MENSAJES mensajes en ${TIEMPO}s = $THROUGHPUT msgs/seg"
    echo "$P,$H,$SENSORES,$REPETICIONES,$TIEMPO,$MENSAJES,$THROUGHPUT" >> "$SALIDA"
  done
done

echo ""
echo "=== Listo. Resultados en $SALIDA ==="
echo "Ahora corre: python3 scripts/analizar_speedup.py"