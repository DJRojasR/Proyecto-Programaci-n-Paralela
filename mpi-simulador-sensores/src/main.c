#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <time.h>
#include <pthread.h>
#include <mpi.h>
#include <mosquitto.h>

#include "config.h"
#include "sensor.h"
#include "zona.h"
#include "mqtt_publisher.h"
#include "control.h"

typedef struct {
    int id_hilo;
    int rank;
    Sensor *sensores;
    int n_sensores;
    int frecuencia_seg;
} HiloArgs;

static void *hilo_trabajador(void *arg_ptr) {
    HiloArgs *args = (HiloArgs *)arg_ptr;
    unsigned int seed = (unsigned int)(time(NULL) ^ (args->rank << 16) ^ (args->id_hilo << 8));

    char client_id[64];
    snprintf(client_id, sizeof(client_id), "sim-r%d-h%d", args->rank, args->id_hilo);

    struct mosquitto *mosq = mqtt_publisher_crear(client_id);
    if (!mosq || mqtt_publisher_conectar(mosq, BROKER_HOST, BROKER_PORT) != MOSQ_ERR_SUCCESS) {
        fprintf(stderr, "[rank %d hilo %d] no se pudo conectar al broker (%s:%d). "
                        "¿Está corriendo Mosquitto? Este hilo no publicará.\n",
                args->rank, args->id_hilo, BROKER_HOST, BROKER_PORT);
        return NULL;
    }

    char payload[256];
    while (!g_detener) {
        for (int i = 0; i < args->n_sensores && !g_detener; i++) {
            sensor_actualizar_lectura(&args->sensores[i], &seed);
            sensor_a_json(&args->sensores[i], payload, sizeof(payload));
            mqtt_publisher_publicar(mosq, TOPIC_SENSORES, payload);
            usleep(PAUSA_ENTRE_MSG_US); /* evita ráfagas que saturen CPU/broker */
        }
        for (int s = 0; s < args->frecuencia_seg && !g_detener; s++) sleep(1);
    }

    mqtt_publisher_destruir(mosq);
    return NULL;
}

static void parsear_argumentos(int argc, char **argv, int *sensores, int *hilos, int *frecuencia) {
    for (int i = 1; i < argc - 1; i++) {
        if (strcmp(argv[i], "--sensores") == 0) *sensores = atoi(argv[i + 1]);
        else if (strcmp(argv[i], "--hilos") == 0) *hilos = atoi(argv[i + 1]);
        else if (strcmp(argv[i], "--frecuencia") == 0) *frecuencia = atoi(argv[i + 1]);
    }
}

int main(int argc, char **argv) {
    int provided;
    /* FUNNELED alcanza: MPI solo se llama desde el hilo principal
     * (los hilos trabajadores solo hablan MQTT, no MPI). */
    MPI_Init_thread(&argc, &argv, MPI_THREAD_FUNNELED, &provided);

    int rank, size;
    MPI_Comm_rank(MPI_COMM_WORLD, &rank);
    MPI_Comm_size(MPI_COMM_WORLD, &size);

    int total_sensores = NUM_SENSORES_DEFAULT;
    int hilos_por_proceso = HILOS_POR_PROCESO_DEFAULT;
    int frecuencia = FRECUENCIA_SEG_DEFAULT;
    parsear_argumentos(argc, argv, &total_sensores, &hilos_por_proceso, &frecuencia);

    control_instalar_manejador_sigint();
    mosquitto_lib_init();

    int inicio, fin;
    zona_calcular_rango(rank, size, total_sensores, &inicio, &fin);
    int mis_sensores = fin - inicio;

    if (rank == 0) {
        printf("=== Simulador Ciudad Inteligente (MPI + Pthreads) ===\n");
        printf("Procesos MPI: %d | Hilos/proceso: %d | Sensores totales: %d | Frecuencia: %ds\n",
               size, hilos_por_proceso, total_sensores, frecuencia);
    }
    printf("[rank %d] atiende sensores %d..%d (%d sensores)\n", rank, inicio, fin - 1, mis_sensores);

    Sensor *sensores_locales = malloc(sizeof(Sensor) * mis_sensores);
    unsigned int seed_init = (unsigned int)(time(NULL) ^ (rank * 7919));
    sensor_inicializar_lote(sensores_locales, mis_sensores, inicio, &seed_init);

    /* Reparto de los sensores locales entre los hilos de este proceso,
     * reutilizando la misma lógica de reparto que usa MPI entre procesos. */
    pthread_t *hilos = malloc(sizeof(pthread_t) * hilos_por_proceso);
    HiloArgs *args = malloc(sizeof(HiloArgs) * hilos_por_proceso);

    for (int h = 0; h < hilos_por_proceso; h++) {
        int hi, hf;
        zona_calcular_rango(h, hilos_por_proceso, mis_sensores, &hi, &hf);
        args[h].id_hilo = h;
        args[h].rank = rank;
        args[h].sensores = &sensores_locales[hi];
        args[h].n_sensores = hf - hi;
        args[h].frecuencia_seg = frecuencia;
        pthread_create(&hilos[h], NULL, hilo_trabajador, &args[h]);
    }

    /* "Botón de detener": en el rank 0, un hilo separado espera 'stop'
     * por stdin (o Ctrl+C via SIGINT). Se desacopla (detach) porque
     * puede quedar bloqueado en fgets() y no queremos esperarlo al salir. */
    if (rank == 0) {
        pthread_t hilo_control;
        pthread_create(&hilo_control, NULL, control_hilo_escucha_stdin, NULL);
        pthread_detach(hilo_control);
    }

    /* Coordinación de parada entre procesos MPI SIN busy-waiting:
     * - rank 0 espera localmente (solo su propio hilo, sin tocar MPI)
     *   a que el hilo de control marque g_detener=1, y entonces avisa
     *   a los demás ranks con un mensaje punto a punto.
     * - los demás ranks solo "espían" con MPI_Iprobe (no bloqueante)
     *   una vez por segundo; el resto del tiempo duermen. Así ningún
     *   proceso queda pegado consumiendo un núcleo entero solo por
     *   estar esperando la señal de parada. */
    if (rank == 0) {
        while (!g_detener) usleep(100000);
        int senal = 1;
        for (int destino = 1; destino < size; destino++) {
            MPI_Send(&senal, 1, MPI_INT, destino, TAG_CONTROL_STOP, MPI_COMM_WORLD);
        }
    } else {
        while (!g_detener) {
            int hay_mensaje = 0;
            MPI_Status status;
            MPI_Iprobe(0, TAG_CONTROL_STOP, MPI_COMM_WORLD, &hay_mensaje, &status);
            if (hay_mensaje) {
                int buf;
                MPI_Recv(&buf, 1, MPI_INT, 0, TAG_CONTROL_STOP, MPI_COMM_WORLD, MPI_STATUS_IGNORE);
                g_detener = 1;
            } else {
                sleep(1);
            }
        }
    }

    if (rank == 0) printf("\n[control] deteniendo simulación de forma ordenada...\n");

    for (int h = 0; h < hilos_por_proceso; h++) pthread_join(hilos[h], NULL);

    free(sensores_locales);
    free(hilos);
    free(args);

    mosquitto_lib_cleanup();
    if (rank == 0) printf("[control] listo, todos los procesos terminaron.\n");
    MPI_Finalize();
    return 0;
}
