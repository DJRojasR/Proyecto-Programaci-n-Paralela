#include <stdlib.h>
#include <stdio.h>
#include <time.h>
#include "sensor.h"
#include "config.h"

static double aleatorio_en_rango(double min, double max, unsigned int *seed) {
    double r = (double)rand_r(seed) / (double)RAND_MAX;
    return min + r * (max - min);
}

void sensor_inicializar_lote(Sensor *sensores, int cantidad, int id_inicial,
                              const RegionGeografica *region, unsigned int *seed) {
    for (int i = 0; i < cantidad; i++) {
        sensores[i].id = id_inicial + i;
        sensores[i].x = (int)aleatorio_en_rango(region->x_min, region->x_max, seed);
        sensores[i].y = (int)aleatorio_en_rango(region->y_min, region->y_max, seed);
        sensores[i].zona = zona_desde_coordenadas(sensores[i].x, sensores[i].y);
        sensores[i].temperatura = 0;
        sensores[i].humedad = 0;
        sensores[i].timestamp = 0;
        sensores[i].seq = 0;
    }
}

void sensor_actualizar_lectura(Sensor *s, unsigned int *seed) {
    s->temperatura = aleatorio_en_rango(TEMP_MIN, TEMP_MAX, seed);
    s->humedad = aleatorio_en_rango(HUM_MIN, HUM_MAX, seed);
    s->timestamp = (long)time(NULL);
    s->seq += 1;
}

int sensor_a_json(const Sensor *s, char *buffer, int buffer_len) {
    return snprintf(buffer, buffer_len,
        "{\"sensor_id\":\"sensor_%06d\",\"zona\":\"%s\",\"x\":%d,\"y\":%d,"
        "\"temperature\":%.1f,\"humidity\":%.1f,\"timestamp\":%ld,\"seq\":%ld}",
        s->id, zona_a_texto(s->zona), s->x, s->y,
        s->temperatura, s->humedad, s->timestamp, s->seq);
}