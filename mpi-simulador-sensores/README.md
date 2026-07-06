# Simulador de Sensores IoT — C + MPI + Pthreads

Este es el otro lado del proyecto: el simulador real de sensores,
escrito en C, que reemplaza al generador de datos ficticios de la
interfaz web (`SimuladorSensores.js`). Este programa publica
mediciones **de verdad** a un broker MQTT — la interfaz web ya no
necesita saber si esos datos vienen de este simulador o de sensores
físicos reales, porque habla el mismo protocolo.

## Cómo se comunican las dos partes

```
┌─────────────────────────────┐        ┌──────────────────────┐        ┌────────────────────────┐
│  SIMULADOR (este proyecto)  │        │   BROKER MQTT         │        │  INTERFAZ WEB           │
│  C + MPI + Pthreads         │──TCP──▶│   Mosquitto            │──WS───▶│  (sensores-iot-frontend)│
│  N procesos × M hilos       │ :1883  │   1 solo proceso,      │ :9001  │  navegador               │
│  cada hilo publica su lote  │        │   2 puertas de entrada │        │  mqtt.js sobre WebSocket │
└─────────────────────────────┘        └──────────────────────┘        └────────────────────────┘
```

**No se comunican directamente entre sí.** Ni el simulador conoce a
la interfaz web, ni la interfaz conoce al simulador — ambos solo
conocen al broker MQTT. Esto es justo lo que pedía el documento del
proyecto (patrón publicador/suscriptor): el simulador publica en el
tópico `ciudad/sensores/medicion`, y cualquiera que esté suscrito a
ese tópico (la interfaz web, o cualquier otra herramienta) recibe los
mensajes sin que el simulador sepa que existe.

La única sutileza es que el simulador (C, `libmosquitto`) habla MQTT
por TCP en el puerto 1883, y el navegador solo puede hablar MQTT por
WebSocket (no puede abrir sockets TCP crudos). Por eso Mosquitto se
configura con **dos listeners sobre el mismo broker** (ver
`scripts/mosquitto.conf`): 1883 para el simulador, 9001 para el
navegador. Es el mismo broker, dos puertas.

## Cómo debería funcionar (flujo completo)

1. Se levanta Mosquitto con `scripts/mosquitto.conf` (una sola vez).
2. Se corre el simulador (`./scripts/ejecutar.sh 1000 2 4 5` → 1000
   sensores, 2 procesos MPI, 4 hilos cada uno, midiendo cada 5s).
3. Cada proceso MPI recibe un rango de sensores (ej. proceso 0 →
   sensores 0-499, proceso 1 → 500-999).
4. Dentro de cada proceso, ese rango se reparte otra vez entre sus
   hilos (ej. 4 hilos × 125 sensores cada uno).
5. Cada hilo, en su propio ciclo, genera una lectura nueva por sensor
   y la publica al broker — con una pequeña pausa entre mensajes para
   no saturar ni el broker ni tu CPU.
6. La interfaz web, conectada al broker por WebSocket y suscrita al
   mismo tópico, recibe cada mensaje y enciende el punto correspondiente
   en el mapa.
7. Para detener: escribes `stop` + Enter en la terminal del simulador
   (ver más abajo el porqué de este mecanismo en vez de solo Ctrl+C).

## Estructura del proyecto

```
mpi-simulador-sensores/
├── Makefile                    # Compila con mpicc, enlaza mosquitto + pthread
├── include/
│   ├── config.h                 # Constantes: sensores por defecto, broker, tópico
│   ├── sensor.h                 # Declaración del modelo Sensor
│   ├── zona.h                   # Reparto de rangos (entre procesos Y entre hilos)
│   ├── mqtt_publisher.h         # Wrapper sobre libmosquitto
│   └── control.h                # Bandera global de parada + manejo de señal
├── src/
│   ├── main.c                   # Orquesta todo: MPI init, reparto, hilos, apagado
│   ├── sensor.c                 # Genera lecturas y arma el JSON
│   ├── zona.c                   # Cálculo de rangos [inicio, fin)
│   ├── mqtt_publisher.c         # Conectar/publicar/desconectar
│   └── control.c                # Hilo que escucha 'stop' por stdin + SIGINT
├── scripts/
│   ├── mosquitto.conf            # Broker con listener TCP + WebSocket
│   └── ejecutar.sh               # make + mpirun con parámetros
└── bin/                          # Binario compilado (se genera con `make`)
```

Cada archivo tiene una sola responsabilidad, igual que en la interfaz
web: `sensor.c` no sabe de MQTT, `mqtt_publisher.c` no sabe qué es un
sensor, `zona.c` no sabe de hilos ni de MPI (solo reparte rangos), y
`main.c` es el único que conoce a todos y los conecta.

## El botón de detener

Pediste que no te sature la computadora, así que el mecanismo de
parada está pensado para ser barato en CPU y para cerrar todo en
orden (no matar procesos a la fuerza, lo que podría dejar el broker
con conexiones colgadas):

- **Recomendado: escribe `stop` + Enter** en la terminal donde corre
  el simulador. Un hilo dedicado en el proceso 0 está esperando
  exactamente eso.
- El proceso 0 avisa a los demás procesos MPI con un mensaje directo
  (no le pregunta a los demás "¿ya paro?" todo el tiempo — eso es lo
  que probé primero y sí llegaba a trabar el programa bajo poca CPU
  disponible, así que lo cambié por avisar una sola vez).
- Cada hilo trabajador nota la señal en su siguiente pausa (como
  mucho ~1 segundo de demora) y se desconecta del broker antes de
  terminar.
- **Ctrl+C también está soportado** a nivel de programa (captura
  SIGINT), pero si corres con `mpirun`, `mpirun` a veces intercepta
  esa señal y mata los procesos directamente antes de que alcancen a
  apagarse en orden. Por eso `stop` por teclado es el camino principal.

## Probado en este entorno

Antes de dártelo, lo compilé y corrí de verdad (no es solo código sin
probar):
- Compila limpio con `mpicc`, sin warnings.
- Con 1000 sensores / 2 procesos / 4 hilos, publicó los 1000 mensajes
  correctamente al broker en un ciclo.
- El botón `stop` cerró los 2 procesos MPI en orden, código de salida 0.

## Cómo correrlo

```bash
# Permisos necesarios ponerlo en la terminal
chmod + ./scripts/ejecutar.sh

# 1. Instalar dependencias (Ubuntu/Debian)
sudo apt install libopenmpi-dev openmpi-bin libmosquitto-dev mosquitto mosquitto-clients

# 2. Levantar el broker con los dos listeners
mosquitto -c scripts/mosquitto.conf -d

# 3. Compilar y correr (1000 sensores, 2 procesos, 4 hilos c/u, cada 5s)
# Importante abrilo en otra terminal 
./scripts/ejecutar.sh 1000 2 4 5

# 4. (opcional) ver los mensajes crudos en otra terminal
mosquitto_sub -h localhost -p 1883 -t 'ciudad/sensores/medicion' -v
```

Si tu máquina tiene pocos núcleos, evita subir mucho `procesos ×
hilos` a la vez (ej. 2×4 = 8 hilos trabajadores es razonable para
1000 sensores en una laptop común).

## MPI: lo que sí y lo que no incluye este entregable

Incluido: reparto de sensores entre procesos MPI (`zona_calcular_rango`),
coordinación de apagado entre procesos (mensaje punto a punto), y
Pthreads dentro de cada proceso para la concurrencia. Es la
arquitectura híbrida MPI + Pthreads que pide el documento, ya
funcional con el objetivo de 1000 sensores.

No incluido todavía (fuera de este entregable): métricas de
speedup/eficiencia/escalabilidad con distintas configuraciones de
proceso/hilos (sección 8-9 del documento) — eso normalmente se hace
corriendo varios experimentos y midiendo tiempos, una vez que esto
esté validado.
