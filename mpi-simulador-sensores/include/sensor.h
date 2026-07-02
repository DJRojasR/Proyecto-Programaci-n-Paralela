#ifndef SENSOR_H
#define SENSOR_H

typedef struct {
    int id;
    int x;
    int y;
    double temperatura;
    double humedad;
    long timestamp;
} Sensor;

/* Crea `cantidad` sensores con posición aleatoria fija (no cambia
 * entre lecturas, solo temperatura/humedad/timestamp cambian). */
void sensor_inicializar_lote(Sensor *sensores, int cantidad, int id_inicial, unsigned int *seed);

/* Genera una nueva lectura para un sensor (temperatura/humedad
 * aleatorias dentro de rango + timestamp actual). */
void sensor_actualizar_lectura(Sensor *s, unsigned int *seed);

/* Serializa el sensor a JSON, mismo formato que espera el frontend
 * (ver Ciudad.aplicarMedicion en la interfaz web). */
int sensor_a_json(const Sensor *s, char *buffer, int buffer_len);

#endif
