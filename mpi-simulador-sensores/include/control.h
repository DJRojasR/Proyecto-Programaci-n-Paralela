#ifndef CONTROL_H
#define CONTROL_H

#include <signal.h>

/* Bandera global, compartida por todos los hilos de este proceso.
 * volatile + sig_atomic_t: es seguro tocarla desde un manejador de señal. */
extern volatile sig_atomic_t g_detener;

/* Instala el manejador de Ctrl+C (SIGINT) que apaga g_detener=1. */
void control_instalar_manejador_sigint(void);

/* Hilo de "botón de detener" en modo texto: se queda leyendo stdin y,
 * al recibir la palabra "stop" (o Ctrl+C), marca g_detener=1.
 * Solo se lanza en el rank 0; los demás ranks se enteran por MPI_Bcast. */
void *control_hilo_escucha_stdin(void *arg);

#endif
