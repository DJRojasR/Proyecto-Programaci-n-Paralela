#ifndef ZONA_H
#define ZONA_H

/* Calcula el rango [inicio, fin) de sensores que le toca a este rank,
 * repartiendo el total lo más parejo posible entre `size` procesos
 * (equivalente al reparto "Proceso 0 -> sensores 1-2500..." del doc). */
void zona_calcular_rango(int rank, int size, int total_sensores, int *inicio, int *fin);

#endif
