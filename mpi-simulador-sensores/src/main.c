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
#include "monitor.h"

typedef struct {
    int id_hilo;
    int rank;
    Sensor *sensores;
    int n_sensores;
    int frecuencia_seg;
    int modo_benchmark; /* 1 = sin pausas, publica a máxima velocidad */
    int n_repeticiones; /* > 0 => modo TRABAJO FIJO: cada sensor publica
                          * exactamente esta cantidad de veces y el hilo
                          * termina solo (no usa g_detener ni loop infinito).
                          * 0 => modo antiguo (por tiempo, hasta stop/g_detener). */
    long mensajes_publicados; /* la va incrementando el propio hilo, sin locks */
} HiloArgs;

static void *hilo_trabajador(void *arg_ptr) {
    HiloArgs *args = (HiloArgs *)arg_ptr;
    unsigned int seed = (unsigned int)(time(NULL) ^ (args->rank << 16) ^ (args->id_hilo << 8));

    char client_id[64];
    snprintf(client_id, sizeof(client_id), "sim-r%d-h%d", args->rank, args->id_hilo);

    struct mosquitto *mosq = mqtt_publisher_crear(client_id);
    if (!mosq || mqtt_publisher_conectar(mosq, BROKER_HOST, BROKER_PORT) != MOSQ_ERR_SUCCESS) {
        fprintf(stderr, "[rank %d hilo %d] no se pudo conectar al broker (%s:%d). "
                        "Esta corriendo Mosquitto? Este hilo no publicara.\n",
                args->rank, args->id_hilo, BROKER_HOST, BROKER_PORT);
        return NULL;
    }

    char payload[256];

    if (args->n_repeticiones > 0) {
        /* --- MODO TRABAJO FIJO ---------------------------------------
         * Cada sensor publica exactamente n_repeticiones mensajes, sin
         * pausas, y el hilo termina solo. Esto es lo que hace posible
         * medir "tiempo para completar el mismo trabajo total" y sacar
         * un speedup real (tiempo_secuencial / tiempo_paralelo), en vez
         * de medir throughput contra un reloj con trabajo infinito
         * (que satura la cola de MQTT si el broker no da abasto). */
        for (int rep = 0; rep < args->n_repeticiones; rep++) {
            for (int i = 0; i < args->n_sensores; i++) {
                sensor_actualizar_lectura(&args->sensores[i], &seed);
                sensor_a_json(&args->sensores[i], payload, sizeof(payload));
                mqtt_publisher_publicar(mosq, TOPIC_SENSORES, payload);
                args->mensajes_publicados++;
            }
        }
    } else {
        /* --- MODO ANTIGUO (por tiempo / demo / --benchmark clásico) --- */
        while (!g_detener) {
            for (int i = 0; i < args->n_sensores && !g_detener; i++) {
                sensor_actualizar_lectura(&args->sensores[i], &seed);
                sensor_a_json(&args->sensores[i], payload, sizeof(payload));
                mqtt_publisher_publicar(mosq, TOPIC_SENSORES, payload);
                args->mensajes_publicados++;
                if (!args->modo_benchmark) usleep(PAUSA_ENTRE_MSG_US);
            }
            if (!args->modo_benchmark) {
                for (int s = 0; s < args->frecuencia_seg && !g_detener; s++) sleep(1);
            }
        }
    }

    mqtt_publisher_destruir(mosq);
    return NULL;
}

static void parsear_argumentos(int argc, char **argv, int *sensores, int *hilos,
                                int *frecuencia, int *modo_benchmark, int *repeticiones) {
    for (int i = 1; i < argc; i++) {
        if (strcmp(argv[i], "--benchmark") == 0) {
            *modo_benchmark = 1;
            continue;
        }
        if (i >= argc - 1) continue;
        if (strcmp(argv[i], "--sensores") == 0) *sensores = atoi(argv[i + 1]);
        else if (strcmp(argv[i], "--hilos") == 0) *hilos = atoi(argv[i + 1]);
        else if (strcmp(argv[i], "--frecuencia") == 0) *frecuencia = atoi(argv[i + 1]);
        else if (strcmp(argv[i], "--repeticiones") == 0) *repeticiones = atoi(argv[i + 1]);
    }
}

int main(int argc, char **argv) {
    int provided;
    MPI_Init_thread(&argc, &argv, MPI_THREAD_FUNNELED, &provided);

    int rank, size;
    MPI_Comm_rank(MPI_COMM_WORLD, &rank);
    MPI_Comm_size(MPI_COMM_WORLD, &size);

    int total_sensores = NUM_SENSORES_DEFAULT;
    int hilos_por_proceso = HILOS_POR_PROCESO_DEFAULT;
    int frecuencia = FRECUENCIA_SEG_DEFAULT;
    int modo_benchmark = 0;
    int n_repeticiones = 0; /* 0 = modo antiguo; > 0 = modo trabajo fijo */
    parsear_argumentos(argc, argv, &total_sensores, &hilos_por_proceso, &frecuencia,
                        &modo_benchmark, &n_repeticiones);
    int modo_fijo = (n_repeticiones > 0);

    control_instalar_manejador_sigint();
    mosquitto_lib_init();

    int inicio, fin;
    zona_calcular_rango(rank, size, total_sensores, &inicio, &fin);
    int mis_sensores = fin - inicio;

    RegionGeografica region;
    zona_region_para_rank(rank, size, &region);

    if (rank == 0) {
        printf("=== Simulador Ciudad Inteligente (MPI + Pthreads) ===\n");
        if (modo_fijo) {
            printf("Procesos MPI: %d | Hilos/proceso: %d | Sensores totales: %d | "
                   "MODO TRABAJO FIJO: %d repeticiones/sensor\n",
                   size, hilos_por_proceso, total_sensores, n_repeticiones);
        } else {
            printf("Procesos MPI: %d | Hilos/proceso: %d | Sensores totales: %d | Frecuencia: %ds%s\n",
                   size, hilos_por_proceso, total_sensores, frecuencia,
                   modo_benchmark ? " | MODO BENCHMARK (sin pausas)" : "");
        }
    }
    printf("[rank %d] zona '%s' -> x:[%d,%d) y:[%d,%d) | %d sensores\n",
           rank, region.etiqueta, region.x_min, region.x_max,
           region.y_min, region.y_max, mis_sensores);

    Sensor *sensores_locales = malloc(sizeof(Sensor) * mis_sensores);
    unsigned int seed_init = (unsigned int)(time(NULL) ^ (rank * 7919));
    sensor_inicializar_lote(sensores_locales, mis_sensores, inicio, &region, &seed_init);

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
        args[h].modo_benchmark = modo_benchmark;
        args[h].n_repeticiones = n_repeticiones;
        args[h].mensajes_publicados = 0;
    }

    long **punteros_contadores = malloc(sizeof(long *) * hilos_por_proceso);
    for (int h = 0; h < hilos_por_proceso; h++) {
        punteros_contadores[h] = &args[h].mensajes_publicados;
    }
    MonitorArgs margs = {
        .rank = rank,
        .hilos_por_proceso = hilos_por_proceso,
        .punteros_contadores = punteros_contadores,
    };
    pthread_t hilo_monitor;
    pthread_create(&hilo_monitor, NULL, monitor_hilo_recursos, &margs);

    if (modo_fijo) {
        /* --- MODO TRABAJO FIJO: medir tiempo hasta completar el trabajo --- */

        /* Sincroniza el arranque entre ranks antes de medir, para que
         * el cronómetro no incluya diferencias de arranque de MPI. */
        MPI_Barrier(MPI_COMM_WORLD);

        struct timespec t_inicio, t_fin;
        clock_gettime(CLOCK_MONOTONIC, &t_inicio);

        for (int h = 0; h < hilos_por_proceso; h++) {
            pthread_create(&hilos[h], NULL, hilo_trabajador, &args[h]);
        }
        for (int h = 0; h < hilos_por_proceso; h++) pthread_join(hilos[h], NULL);

        clock_gettime(CLOCK_MONOTONIC, &t_fin);
        double elapsed_local = (t_fin.tv_sec - t_inicio.tv_sec)
                              + (t_fin.tv_nsec - t_inicio.tv_nsec) / 1e9;

        /* El tiempo total del trabajo es el del rank MÁS LENTO: si un
         * rank tarda más en publicar sus mensajes, el trabajo global
         * no está "completo" hasta que ese también termina. */
        double elapsed_max = 0.0;
        MPI_Reduce(&elapsed_local, &elapsed_max, 1, MPI_DOUBLE, MPI_MAX, 0, MPI_COMM_WORLD);

        g_detener = 1; /* para que el hilo monitor también termine */
        pthread_join(hilo_monitor, NULL);

        if (rank == 0) {
            long total_mensajes = (long)total_sensores * (long)n_repeticiones;
            double throughput = (elapsed_max > 0) ? total_mensajes / elapsed_max : 0.0;
            /* Línea con formato fijo, fácil de grep/parsear desde el script: */
            printf("RESULTADO_FIJO,%d,%d,%d,%d,%.6f,%ld,%.2f\n",
                   size, hilos_por_proceso, total_sensores, n_repeticiones,
                   elapsed_max, total_mensajes, throughput);
        }

        free(sensores_locales);
        free(hilos);
        free(args);
        free(punteros_contadores);
        mosquitto_lib_cleanup();
        MPI_Finalize();
        return 0;
    }

    /* --- MODO ANTIGUO (demo en vivo / --benchmark clásico por tiempo) --- */

    for (int h = 0; h < hilos_por_proceso; h++) {
        pthread_create(&hilos[h], NULL, hilo_trabajador, &args[h]);
    }

    if (rank == 0) {
        pthread_t hilo_control;
        pthread_create(&hilo_control, NULL, control_hilo_escucha_stdin, NULL);
        pthread_detach(hilo_control);
    }

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

    if (rank == 0) printf("\n[control] deteniendo simulaci\xc3\xb3n de forma ordenada...\n");

    for (int h = 0; h < hilos_por_proceso; h++) pthread_join(hilos[h], NULL);
    pthread_join(hilo_monitor, NULL);

    free(sensores_locales);
    free(hilos);
    free(args);
    free(punteros_contadores);

    mosquitto_lib_cleanup();
    if (rank == 0) printf("[control] listo, todos los procesos terminaron.\n");
    MPI_Finalize();
    return 0;
}