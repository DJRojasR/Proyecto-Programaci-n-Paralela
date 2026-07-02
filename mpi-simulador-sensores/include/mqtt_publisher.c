#include <stdio.h>
#include <string.h>
#include "mqtt_publisher.h"

struct mosquitto *mqtt_publisher_crear(const char *client_id) {
    struct mosquitto *mosq = mosquitto_new(client_id, true, NULL);
    if (!mosq) {
        fprintf(stderr, "[mqtt] no se pudo crear cliente %s\n", client_id);
        return NULL;
    }
    return mosq;
}

int mqtt_publisher_conectar(struct mosquitto *mosq, const char *host, int puerto) {
    int rc = mosquitto_connect(mosq, host, puerto, 30 /* keepalive seg */);
    if (rc != MOSQ_ERR_SUCCESS) {
        fprintf(stderr, "[mqtt] error conectando a %s:%d -> %s\n",
                host, puerto, mosquitto_strerror(rc));
        return rc;
    }
    /* Hilo de red en segundo plano: mantiene la conexión viva (PINGs, etc.)
     * sin que el hilo trabajador tenga que preocuparse por eso. */
    mosquitto_loop_start(mosq);
    return MOSQ_ERR_SUCCESS;
}

int mqtt_publisher_publicar(struct mosquitto *mosq, const char *topic, const char *payload) {
    return mosquitto_publish(mosq, NULL, topic, (int)strlen(payload), payload, 0, false);
}

void mqtt_publisher_destruir(struct mosquitto *mosq) {
    if (!mosq) return;
    mosquitto_loop_stop(mosq, true);
    mosquitto_disconnect(mosq);
    mosquitto_destroy(mosq);
}
