#!/bin/bash
# Uso: ./scripts/ejecutar.sh [sensores] [procesos_mpi] [hilos_por_proceso] [frecuencia_seg]
set -e

SENSORES=${1:-1000}
PROCESOS=${2:-2}
HILOS=${3:-4}
FRECUENCIA=${4:-5}

echo "Compilando..."
make

echo ""
echo "Sensores: $SENSORES | Procesos MPI: $PROCESOS | Hilos/proceso: $HILOS | Frecuencia: ${FRECUENCIA}s"
echo "Total de hilos trabajadores: $((PROCESOS * HILOS))"
echo ""
echo "Para detener: escribe 'stop' + Enter en esta terminal."
echo ""

mpirun --oversubscribe -np "$PROCESOS" ./bin/simulador \
  --sensores "$SENSORES" --hilos "$HILOS" --frecuencia "$FRECUENCIA"
