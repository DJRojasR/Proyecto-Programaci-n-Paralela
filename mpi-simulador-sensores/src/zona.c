#include "zona.h"

void zona_calcular_rango(int rank, int size, int total_sensores, int *inicio, int *fin) {
    int base = total_sensores / size;
    int resto = total_sensores % size;

    /* Los primeros `resto` procesos absorben 1 sensor extra cada uno,
     * para no dejar sensores sin asignar cuando la división no es exacta. */
    if (rank < resto) {
        *inicio = rank * (base + 1);
        *fin = *inicio + (base + 1);
    } else {
        *inicio = resto * (base + 1) + (rank - resto) * base;
        *fin = *inicio + base;
    }
}
