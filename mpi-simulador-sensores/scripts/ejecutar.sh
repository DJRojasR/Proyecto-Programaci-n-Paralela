#!/bin/bash
# Uso: ./scripts/ejecutar.sh [--benchmark] [sensores] [procesos_mpi] [hilos_por_proceso] [frecuencia_seg]
# --benchmark puede ir en cualquier posición del comando.
set -e

BENCHMARK=""
POSICIONALES=()

for arg in "$@"; do
    if [ "$arg" == "--benchmark" ]; then
        BENCHMARK="--benchmark"
    else
        POSICIONALES+=("$arg")
    fi
done

SENSORES=${POSICIONALES[0]:-1000}
PROCESOS=${POSICIONALES[1]:-2}
HILOS=${POSICIONALES[2]:-4}
FRECUENCIA=${POSICIONALES[3]:-5}

echo "Compilando..."
make

echo ""
echo "Sensores: $SENSORES | Procesos MPI: $PROCESOS | Hilos/proceso: $HILOS | Frecuencia: ${FRECUENCIA}s${BENCHMARK:+ | MODO BENCHMARK}"
echo "Total de hilos trabajadores: $((PROCESOS * HILOS))"
echo ""
echo "Para detener: escribe 'stop' + Enter en esta terminal."
echo ""

mpirun --oversubscribe -np "$PROCESOS" ./bin/simulador \
  --sensores "$SENSORES" --hilos "$HILOS" --frecuencia "$FRECUENCIA" $BENCHMARK