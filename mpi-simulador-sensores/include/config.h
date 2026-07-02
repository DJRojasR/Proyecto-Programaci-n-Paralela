#ifndef CONFIG_H
#define CONFIG_H

/* Objetivo principal del proyecto: correr cómodo con 1000 sensores
 * en una laptop normal. Si algún día se sube a 10k/100k, esto es lo
 * único que hay que tocar (y probablemente subir procesos MPI). */
#define NUM_SENSORES_DEFAULT   1000
#define HILOS_POR_PROCESO_DEFAULT 4

#define BROKER_HOST "localhost"
#define BROKER_PORT 1883
#define TOPIC_SENSORES "ciudad/sensores/medicion"
#define TOPIC_CONTROL  "ciudad/control/estado"
#define TAG_CONTROL_STOP 99

#define FRECUENCIA_SEG_DEFAULT 5   /* cada cuánto se re-mide un sensor */
#define PAUSA_ENTRE_MSG_US 15000   /* 15ms entre publicaciones -> no satura CPU ni broker */

#define CIUDAD_ANCHO 1000
#define CIUDAD_ALTO  1000

#define TEMP_MIN 15.0
#define TEMP_MAX 34.0
#define HUM_MIN  30.0
#define HUM_MAX  90.0

#endif
