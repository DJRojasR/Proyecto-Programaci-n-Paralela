#ifndef SENSOR_H
#define SENSOR_H

#include "zona.h"

typedef struct {
    int id;
    int x;
    int y;
    ZonaId zona;
    double temperatura;
    double humedad;
    long timestamp;
    long seq; /* número de secuencia propio del sensor, para detectar pérdida */
} Sensor;

/* Crea `cantidad` sensores con posición aleatoria DENTRO de `region`
 * (no cambia entre lecturas, solo temperatura/humedad/timestamp/seq
 * cambian). La zona de cada sensor se calcula de su (x,y) real, así
 * que siempre es correcta aunque `region` no calce exacto con una de
 * las 4 zonas con nombre (ver zona_region_para_rank, caso genérico). */
void sensor_inicializar_lote(Sensor *sensores, int cantidad, int id_inicial,
                              const RegionGeografica *region, unsigned int *seed);

/* Genera una nueva lectura para un sensor (temperatura/humedad
 * aleatorias dentro de rango + timestamp actual + siguiente seq). */
void sensor_actualizar_lectura(Sensor *s, unsigned int *seed);

/* Serializa el sensor a JSON, mismo formato que espera el frontend
 * (ver Ciudad.aplicarMedicion en la interfaz web), incluyendo zona y seq. */
int sensor_a_json(const Sensor *s, char *buffer, int buffer_len);

#endif