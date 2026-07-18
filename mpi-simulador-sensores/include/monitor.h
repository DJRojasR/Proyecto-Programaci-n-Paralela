#ifndef MONITOR_H
#define MONITOR_H

/* Hilo que cada cierto tiempo (HEARTBEAT_INTERVAL_SEG) mide el uso de
 * CPU y memoria de este proceso (via archivos en /proc) y lo publica
 * al topico de control, para que el dashboard lo muestre en vivo. */

typedef struct {
    int rank;
    int hilos_por_proceso;
    long **punteros_contadores; /* uno por hilo trabajador, para sumar mensajes publicados */
} MonitorArgs;

void *monitor_hilo_recursos(void *arg_ptr);

#endif