#include <stdio.h>
#include <string.h>
#include <unistd.h>
#include <time.h>
#include "monitor.h"
#include "mqtt_publisher.h"
#include "control.h"
#include "config.h"

/* Lee VmRSS (memoria física realmente usada por el proceso) de
 * /proc/self/status. Devuelve KB, o -1 si no se pudo leer. */
static long leer_vmrss_kb(void) {
    FILE *f = fopen("/proc/self/status", "r");
    if (!f) return -1;
    char linea[256];
    long rss = -1;
    while (fgets(linea, sizeof(linea), f)) {
        if (strncmp(linea, "VmRSS:", 6) == 0) {
            sscanf(linea + 6, "%ld", &rss);
            break;
        }
    }
    fclose(f);
    return rss;
}

/* Lee tiempo de CPU consumido (usuario+sistema, en ticks) de
 * /proc/self/stat. El "comm" (nombre del programa) puede tener
 * espacios y paréntesis, así que se ubica por el último ')'. */
static int leer_tiempos_cpu(long *utime, long *stime) {
    FILE *f = fopen("/proc/self/stat", "r");
    if (!f) return -1;
    char buffer[512];
    if (!fgets(buffer, sizeof(buffer), f)) { fclose(f); return -1; }
    fclose(f);

    char *fin_comm = strrchr(buffer, ')');
    if (!fin_comm) return -1;

    long ut, st;
    /* Después de ')': state pid ppid pgrp session tty_nr tpgid flags
     * minflt cminflt majflt cmajflt utime stime ... */
    int leidos = sscanf(fin_comm + 2,
        "%*c %*d %*d %*d %*d %*d %*u %*u %*u %*u %*u %ld %ld",
        &ut, &st);
    if (leidos != 2) return -1;
    *utime = ut;
    *stime = st;
    return 0;
}

void *monitor_hilo_recursos(void *arg_ptr) {
    MonitorArgs *args = (MonitorArgs *)arg_ptr;

    char client_id[64];
    snprintf(client_id, sizeof(client_id), "monitor-r%d", args->rank);
    struct mosquitto *mosq = mqtt_publisher_crear(client_id);
    if (!mosq || mqtt_publisher_conectar(mosq, BROKER_HOST, BROKER_PORT) != MOSQ_ERR_SUCCESS) {
        fprintf(stderr, "[rank %d monitor] no se pudo conectar al broker, "
                        "sin métricas de CPU/memoria para este proceso\n", args->rank);
        return NULL;
    }

    long ut_prev = 0, st_prev = 0;
    leer_tiempos_cpu(&ut_prev, &st_prev);
    struct timespec t_prev;
    clock_gettime(CLOCK_MONOTONIC, &t_prev);
    long clk_tck = sysconf(_SC_CLK_TCK);

    while (!g_detener) {
        sleep(HEARTBEAT_INTERVAL_SEG);
        if (g_detener) break;

        struct timespec t_ahora;
        clock_gettime(CLOCK_MONOTONIC, &t_ahora);

        double cpu_pct = 0.0;
        long ut, st;
        if (leer_tiempos_cpu(&ut, &st) == 0 && clk_tck > 0) {
            double delta_cpu_seg = (double)((ut - ut_prev) + (st - st_prev)) / (double)clk_tck;
            double delta_wall_seg = (t_ahora.tv_sec - t_prev.tv_sec)
                                   + (t_ahora.tv_nsec - t_prev.tv_nsec) / 1e9;
            if (delta_wall_seg > 0) cpu_pct = (delta_cpu_seg / delta_wall_seg) * 100.0;
            ut_prev = ut;
            st_prev = st;
        }
        t_prev = t_ahora;

        long mem_kb = leer_vmrss_kb();

        long mensajes_totales = 0;
        for (int h = 0; h < args->hilos_por_proceso; h++) {
            mensajes_totales += *(args->punteros_contadores[h]);
        }

        char payload[256];
        snprintf(payload, sizeof(payload),
            "{\"rank\":%d,\"cpu_pct\":%.1f,\"mem_kb\":%ld,\"mensajes_publicados\":%ld}",
            args->rank, cpu_pct, mem_kb, mensajes_totales);

        mqtt_publisher_publicar(mosq, TOPIC_CONTROL, payload);
    }

    mqtt_publisher_destruir(mosq);
    return NULL;
}