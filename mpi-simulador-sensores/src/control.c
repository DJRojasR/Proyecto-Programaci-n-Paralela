#include <stdio.h>
#include <string.h>
#include "control.h"

volatile sig_atomic_t g_detener = 0;

static void manejador_sigint(int signum) {
    (void)signum;
    g_detener = 1;
}

void control_instalar_manejador_sigint(void) {
    signal(SIGINT, manejador_sigint);
}

void *control_hilo_escucha_stdin(void *arg) {
    (void)arg;
    char linea[64];
    printf("[control] escribe 'stop' + Enter para detener la simulación en orden "
           "(o Ctrl+C)\n");
    while (!g_detener) {
        if (fgets(linea, sizeof(linea), stdin) == NULL) break;
        if (strncmp(linea, "stop", 4) == 0) {
            g_detener = 1;
            break;
        }
    }
    return NULL;
}
