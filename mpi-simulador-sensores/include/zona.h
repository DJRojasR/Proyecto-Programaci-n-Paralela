#ifndef ZONA_H
#define ZONA_H

/* Calcula el rango [inicio, fin) de sensores que le toca a este rank,
 * repartiendo el total lo más parejo posible entre `size` procesos
 * (se sigue usando para dividir sensores entre HILOS dentro de un
 * proceso, y para calcular cuántos sensores le tocan a cada rank). */
void zona_calcular_rango(int rank, int size, int total_sensores, int *inicio, int *fin);

/* --- Zonas geográficas de la ciudad --------------------------------
 * La ciudad se divide en 4 zonas base según el punto medio de sus
 * coordenadas (ver sección 5 del documento del proyecto):
 *   NORTE: x < mitad, y < mitad      SUR:   x < mitad, y >= mitad
 *   ESTE:  x >= mitad, y < mitad     OESTE: x >= mitad, y >= mitad
 */
typedef enum {
    ZONA_NORTE = 0,
    ZONA_SUR = 1,
    ZONA_ESTE = 2,
    ZONA_OESTE = 3,
} ZonaId;

/* Rectángulo geográfico [x_min,x_max) x [y_min,y_max) asignado a un
 * proceso MPI, con una etiqueta legible ("Norte", "Norte1", etc). */
typedef struct {
    int x_min, x_max;
    int y_min, y_max;
    char etiqueta[24];
} RegionGeografica;

/* Determina a qué una de las 4 zonas base pertenece un punto (x,y). */
ZonaId zona_desde_coordenadas(int x, int y);

/* Nombre legible de una zona base (para el campo "zona" del JSON). */
const char *zona_a_texto(ZonaId z);

/* Calcula la región geográfica que le toca a este rank, repartiendo
 * las 4 zonas base entre los `size` procesos MPI:
 *   size == 1 -> un solo rank atiende toda la ciudad
 *   size == 2 -> rank 0 = Norte+Este (mitad superior),
 *                rank 1 = Sur+Oeste (mitad inferior)
 *   size == 4 -> un rank por zona (0=Norte,1=Sur,2=Este,3=Oeste)
 *   size == 8 -> 2 ranks por zona, cada uno con la mitad de esa zona
 *   otro tamaño -> reparto genérico en franjas verticales iguales
 */
void zona_region_para_rank(int rank, int size, RegionGeografica *out);

#endif