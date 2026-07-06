#ifndef MQTT_PUBLISHER_H
#define MQTT_PUBLISHER_H

#include <mosquitto.h>

/* Envoltorio delgado sobre libmosquitto. Cada hilo trabajador crea
 * su propia instancia (un cliente MQTT por hilo, no compartido), así
 * no hay que preocuparse por locks al publicar. */

struct mosquitto *mqtt_publisher_crear(const char *client_id);
int mqtt_publisher_conectar(struct mosquitto *mosq, const char *host, int puerto);
int mqtt_publisher_publicar(struct mosquitto *mosq, const char *topic, const char *payload);
void mqtt_publisher_destruir(struct mosquitto *mosq);

#endif
