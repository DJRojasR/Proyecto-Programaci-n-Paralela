# Simulador de Sensores IoT — C + MPI + Pthreads

Este es el otro lado del proyecto: el simulador real de sensores,
escrito en C, que reemplaza al generador de datos ficticios de la
interfaz web (`SimuladorSensores.js`). Este programa publica
mediciones **de verdad** a un broker MQTT — la interfaz web ya no
necesita saber si esos datos vienen de este simulador o de sensores
físicos reales, porque habla el mismo protocolo.

## Cómo se comunican las dos partes

┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                    ARQUITECTURA COMPLETA - PUBLICADOR/SUSCRIPTOR MQTT                      │
└─────────────────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                                                                                             │
│  ┌─────────────────────────────┐          ┌─────────────────────────────┐                   │
│  │                             │          │                             │                   │
│  │  🖥️ SIMULADOR              │          │  📡 BROKER MQTT             │                   │
│  │  (C + MPI + Pthreads)      │          │  (Mosquitto)                │                   │
│  │                             │          │                             │                   │
│  │  📤 Publicador              │          │  ┌─────────────────────────┐│                   │
│  │                             │          │  │  📥 TCP Listener        ││                   │
│  │  ┌────────────────────────┐│          │  │  Puerto: 1883           ││                   │
│  │  │  Proceso 0 (rank 0)    ││          │  │  Protocolo: MQTT        ││                   │
│  │  │  ├─ Hilo 0             ││          │  └─────────────────────────┘│                   │
│  │  │  ├─ Hilo 1             ││          │              ▲              │                   │
│  │  │  └─ Hilo M             ││          │              │              │                   │
│  │  │  └─ Monitor (CPU/Mem)  ││          │              │              │                   │
│  │  └────────────────────────┘│          │              │              │                   │
│  │                             │          │              │              │                   │
│  │  ┌────────────────────────┐│          │  ┌─────────────────────────┐│                   │
│  │  │  Proceso N (rank N)    ││──TCP────┼─▶│  🔄 Distribuye a        ││                   │
│  │  │  ├─ Hilo 0             ││          │  │  todos los suscriptores ││                   │
│  │  │  ├─ Hilo 1             ││          │  └─────────────────────────┘│                   │
│  │  │  └─ Hilo M             ││          │              ▲              │                   │
│  │  │  └─ Monitor (CPU/Mem)  ││          │              │              │                   │
│  │  └────────────────────────┘│          │              │              │                   │
│  │                             │          │  ┌─────────────────────────┐│                   │
│  │  📤 Tópicos:               │          │  │  📤 WS Listener         ││                   │
│  │  • ciudad/sensores/medicion│          │  │  Puerto: 9001           ││                   │
│  │  • ciudad/control/estado   │          │  │  Protocolo: WS-MQTT     ││                   │
│  │                             │          │  └─────────────────────────┘│                   │
│  └─────────────────────────────┘          └─────────────────────────────┘                   │
│                                                       │                                      │
│                                                       │ WebSocket (WS)                       │
│                                                       │ Puerto: 9001                         │
│                                                       ▼                                      │
│  ┌─────────────────────────────────────────────────────────────────────────────────────────┐│
│  │                                                                                         ││
│  │  🌐 INTERFAZ WEB (sensores-iot-frontend)                                               ││
│  │                                                                                         ││
│  │  📥 Suscriptor                                                                         ││
│  │  ┌─────────────────────────────────────────────────────────────────────┐                ││
│  │  │  Navegador (Chrome/Firefox)                                        │                ││
│  │  │  ├─ mqtt.js (librería MQTT sobre WebSocket)                       │                ││
│  │  │  ├─ MQTTClient.js (cliente personalizado)                         │                ││
│  │  │  │   └─ Conecta a ws://localhost:9001                            │                ││
│  │  │  │   └─ Suscribe a:                                               │                ││
│  │  │  │       • ciudad/sensores/medicion  →  Mapa + Métricas          │                ││
│  │  │  │       • ciudad/control/estado      →  Status Bar (CPU/Mem)    │                ││
│  │  │  └─ WebGLRenderer (visualización en tiempo real)                 │                ││
│  │  └─────────────────────────────────────────────────────────────────────┘                ││
│  │                                                                                         ││
│  └─────────────────────────────────────────────────────────────────────────────────────────┘│
│                                                                                             │
└─────────────────────────────────────────────────────────────────────────────────────────────┘

📌 NOTA: Simulador y Frontend NO se comunican directamente.
         Solo se comunican a través del broker MQTT.

**No se comunican directamente entre sí.** Ni el simulador conoce a
la interfaz web, ni la interfaz conoce al simulador — ambos solo
conocen al broker MQTT (patrón publicador/suscriptor). El simulador
publica en dos tópicos distintos:

| Tópico | Quién publica | Contenido |
|---|---|---|
| `ciudad/sensores/medicion` | cada hilo trabajador | mediciones de sensores (con `zona` y `seq`) |
| `ciudad/control/estado` | un hilo de monitoreo por proceso | CPU %, memoria (KB) y mensajes publicados de ese proceso |

La única sutileza de red es que el simulador (C, `libmosquitto`) habla
MQTT por TCP en el puerto 1883, y el navegador solo puede hablar MQTT
por WebSocket. Por eso Mosquitto se configura con **dos listeners
sobre el mismo broker** (ver `scripts/mosquitto.conf`): 1883 para el
simulador, 9001 para el navegador.

## Estructura del proyecto

```
mpi-simulador-sensores/
├── Makefile                    # Compila con mpicc, enlaza mosquitto + pthread
├── include/
│   ├── config.h                 # Constantes: sensores por defecto, broker, tópicos, ciudad
│   ├── sensor.h                 # Modelo Sensor (incluye zona y seq)
│   ├── zona.h                   # Reparto de rangos + zonas geográficas de la ciudad
│   ├── mqtt_publisher.h         # Wrapper sobre libmosquitto
│   ├── monitor.h                # Hilo de métricas de CPU/memoria por proceso
│   └── control.h                # Bandera global de parada + manejo de señal
├── src/
│   ├── main.c                   # Orquesta todo: MPI init, reparto, hilos, modos de ejecución
│   ├── sensor.c                 # Genera lecturas, arma el JSON, calcula zona por coordenadas
│   ├── zona.c                   # Rangos [inicio, fin) + regiones geográficas por rank
│   ├── mqtt_publisher.c         # Conectar/publicar/desconectar
│   ├── monitor.c                # Lee /proc/self/status y /proc/self/stat, publica heartbeat
│   └── control.c                # Hilo que escucha 'stop' por stdin + SIGINT
├── scripts/
│   ├── mosquitto.conf            # Broker con listener TCP + WebSocket
│   ├── ejecutar.sh               # make + mpirun (modo demo / benchmark)
│   ├── medir_speedup.sh          # Corre la matriz de experimentos (modo trabajo fijo)
│   └── analizar_speedup.py       # Calcula speedup/eficiencia y genera gráficas
└── bin/                          # Binario compilado (se genera con `make`)
```

Cada archivo tiene una sola responsabilidad: `sensor.c` no sabe de
MQTT, `mqtt_publisher.c` no sabe qué es un sensor, `zona.c` no sabe de
hilos ni de MPI (solo reparte rangos y calcula regiones), `monitor.c`
solo mide recursos del proceso, y `main.c` es el único que conoce a
todos y los conecta.

## Distribución geográfica (no por rango de ID)

Cada proceso MPI recibe un **rectángulo geográfico** de la ciudad
(1000×1000 unidades lógicas por defecto), y sus sensores nacen con
coordenadas dentro de ese rectángulo. El reparto exacto depende del
número de procesos:

| Procesos | Reparto |
|---|---|
| 1 | un solo proceso atiende toda la ciudad |
| 2 | rank 0 = Norte+Este; rank 1 = Sur+Oeste |
| 4 | un proceso por zona: 0=Norte, 1=Sur, 2=Este, 3=Oeste |
| 8 | 2 procesos por zona, cada uno con la mitad en x |
| otro N | franjas verticales iguales (reparto genérico) |

Dentro de cada proceso, `zona_calcular_rango` se reutiliza para
repartir esos sensores entre los hilos. Cada sensor calcula su zona
real (Norte/Sur/Este/Oeste) a partir de sus propias coordenadas, así
que el campo `"zona"` del JSON es siempre correcto aunque el rectángulo
de un proceso no calce exacto con una de las 4 zonas con nombre.

## Los tres modos de ejecución del binario

El mismo binario (`bin/simulador`) soporta tres formas de correr,
según lo que necesites hacer:

### 1. Modo demo (sin flags) — para ver la interfaz gráfica en vivo

```bash
./scripts/ejecutar.sh 1000 2 4 5   # sensores, procesos, hilos, frecuencia
```

Cada hilo pausa `PAUSA_ENTRE_MSG_US` (15ms) entre mensajes y espera
`frecuencia` segundos completos entre rondas — a propósito, para no
saturar el broker ni la interfaz web mientras se observa en tiempo
real. El throughput queda topado en `sensores / frecuencia`, sin
importar cuántos procesos/hilos uses; **este modo no sirve para medir
paralelismo**, solo para la demo visual.

Se detiene escribiendo `stop` + Enter en la terminal (ver más abajo).

### 2. Modo `--benchmark` — publica sin pausas, por tiempo

```bash
./scripts/ejecutar.sh --benchmark 100000 4 4 1
# --benchmark puede ir en cualquier posición del comando:
./scripts/ejecutar.sh 100000 4 4 1 --benchmark
```

Sin pausas entre mensajes ni entre rondas: publica a la máxima
velocidad que la CPU/red permitan, corriendo indefinidamente hasta que
se detiene con `stop` (o con un `timeout` externo). Útil para
observar comportamiento sostenido, pero **si el broker no puede
recibir mensajes tan rápido como se generan, la cola interna de
`libmosquitto` crece sin límite** (memoria y CPU se disparan) — no es
un bug del simulador, es el broker actuando como cuello de botella
compartido. Para medir esto de forma controlada, ver el modo 3.

Nunca abras el frontend mientras corres benchmark a alta escala: el
navegador no puede procesar miles de mensajes/segundo y se congela.
Para observar throughput real sin frontend:
```bash
mosquitto_sub -h localhost -t "ciudad/control/estado"
```

### 3. Modo `--repeticiones N` — trabajo fijo, para medir speedup real

```bash
./bin/simulador --sensores 10000 --hilos 4 --repeticiones 20
```

Cada sensor publica **exactamente** `N` mensajes y el programa
termina solo (no usa `g_detener`, no espera ningún `stop`). Se mide el
tiempo real desde que se crean los hilos hasta que todos terminan
(`clock_gettime` + `MPI_Barrier` al inicio, `MPI_Reduce` con `MPI_MAX`
al final para tomar el tiempo del rank más lento). Al terminar, el
rank 0 imprime una línea parseable:

```
RESULTADO_FIJO,<procesos>,<hilos>,<sensores>,<repeticiones>,<tiempo_seg>,<mensajes>,<throughput>
```

Este es el modo correcto para calcular speedup (`tiempo_secuencial /
tiempo_paralelo`) y eficiencia (`speedup / trabajadores`), porque el
trabajo total es fijo — no depende de cuánto tiempo esté corriendo el
programa ni de si el broker logra absorber todo lo que se publica.

**Importante:** el throughput que reporta este modo mide qué tan
rápido el simulador *llama* a `mosquitto_publish()` (producción), no
necesariamente cuántos mensajes confirma el broker como entregados
(entrega real). Con QoS 0, ambos números pueden diferir bastante — si
quieres el número de entrega real, complementa con `mosquitto_sub`
contando mensajes en una ventana de tiempo aparte.

## Medir speedup y eficiencia (matriz completa)

```bash
make
./scripts/medir_speedup.sh 10000 20 "1 2 4" "1 2 4 8"
# sensores=10000, repeticiones=20, lista de procesos, lista de hilos
python3 scripts/analizar_speedup.py
```

`medir_speedup.sh` corre el binario en modo `--repeticiones` con cada
combinación de procesos/hilos, sin `timeout` ni `kill` (el programa
termina solo), y guarda todo en `resultados_speedup.csv`.
`analizar_speedup.py` lee ese CSV, calcula speedup/eficiencia contra
la corrida base (1 proceso × 1 hilo) y genera tres gráficas en
`outputs_speedup/`: throughput, speedup (con línea ideal) y eficiencia
vs. número de trabajadores.

Si tu VM tiene pocos núcleos, no pases de `procesos × hilos` = núcleos
físicos disponibles si quieres medir paralelismo real y no contención
de CPU por sobre-suscripción.

## Métricas de CPU y memoria (`monitor.c`)

Cada proceso MPI lanza un hilo adicional que, cada
`HEARTBEAT_INTERVAL_SEG` (2s por defecto):
- Lee `/proc/self/status` → memoria física real usada (`VmRSS`).
- Lee `/proc/self/stat` → calcula % de CPU comparando tiempo de CPU
  consumido contra tiempo real transcurrido entre dos lecturas.
- Publica al tópico `ciudad/control/estado` junto con la suma de
  `mensajes_publicados` de todos los hilos de ese proceso.

Este hilo usa su propia conexión MQTT (`monitor-r<rank>`) y se apaga
junto con el resto de hilos al recibir la señal de parada.

## El botón de detener (solo en modo demo / benchmark por tiempo)

- **Recomendado: escribe `stop` + Enter** en la terminal donde corre
  el simulador.
- El proceso 0 avisa a los demás procesos MPI con un mensaje directo
  una sola vez (no pregunta "¿ya paro?" en bucle, eso llegaba a trabar
  el programa con poca CPU disponible).
- Cada hilo trabajador nota la señal en su siguiente pausa (como mucho
  ~1 segundo de demora) y se desconecta del broker antes de terminar.
- **Ctrl+C también está soportado** (captura SIGINT), pero si corres
  con `mpirun`, a veces intercepta la señal y mata los procesos antes
  de que se apaguen en orden — por eso `stop` por teclado es el camino
  principal.
- El modo `--repeticiones` no usa este mecanismo: termina solo al
  completar el trabajo fijo.

## Cómo correrlo

```bash
# Permisos necesarios
chmod +x ./scripts/ejecutar.sh ./scripts/medir_speedup.sh

# 1. Instalar dependencias (Ubuntu/Debian)
sudo apt install libopenmpi-dev openmpi-bin libmosquitto-dev mosquitto mosquitto-clients
pip install matplotlib --break-system-packages   # para analizar_speedup.py

# 2. Levantar el broker con los dos listeners
mosquitto -c scripts/mosquitto.conf -V

# 3a. Demo visual (abrir en otra terminal, con el frontend levantado)
./scripts/ejecutar.sh 1000 2 4 5

# 3b. Experimentos de speedup/eficiencia (sin frontend abierto)
./scripts/medir_speedup.sh 10000 20 "1 2 4" "1 2 4 8"
python3 scripts/analizar_speedup.py

# 4. (opcional) ver los mensajes crudos en otra terminal
mosquitto_sub -h localhost -p 1883 -t 'ciudad/sensores/medicion' -v
mosquitto_sub -h localhost -p 1883 -t 'ciudad/control/estado' -v
```

## Probado en este entorno

- Compila limpio con `mpicc`, sin warnings.
- Modo demo: con 1000 sensores / 2 procesos / 4 hilos, publicó
  correctamente al broker en ciclo continuo; `stop` cerró los 2
  procesos MPI en orden, código de salida 0.
- Modo `--repeticiones`: corrida completa de la matriz 1-8
  procesos/hilos con 10,000 sensores, resultados consistentes y
  reproducibles (ver `resultados_speedup.csv` / informe técnico).

## Hallazgo de escalabilidad (para la sección de análisis del informe)

En las pruebas realizadas, escalar con más **procesos MPI** resultó
notablemente más eficiente que escalar con más **hilos Pthreads**
dentro de un mismo proceso (ver `outputs_speedup/eficiencia_vs_trabajadores.png`).
Se identificaron dos causas probables: (1) cada hilo abre su propia
conexión MQTT con su propio hilo de red interno, generando
sobre-suscripción de hilos dentro de un proceso; y (2) los sensores de
un mismo proceso viven en un arreglo contiguo en memoria, lo que puede
producir *false sharing* entre hilos que escriben posiciones cercanas
en caché — algo que no ocurre entre procesos MPI, que tienen memoria
completamente separada. No se identificó riesgo de deadlock (no se
usan mutexes: cada hilo opera sobre un subconjunto disjunto de
sensores), aunque existe una condición de carrera benigna sobre el
contador `mensajes_publicados`, leído por el hilo de monitoreo sin
operaciones atómicas — afecta solo la precisión momentánea de una
métrica de reporte, no la correctitud del sistema.

## MPI: lo que incluye este entregable

Reparto geográfico de sensores entre procesos MPI
(`zona_region_para_rank` + `zona_calcular_rango`), coordinación de
apagado entre procesos (mensaje punto a punto), Pthreads dentro de
cada proceso para la concurrencia, métricas de CPU/memoria por
proceso, y medición de speedup/eficiencia con trabajo fijo
reproducible entre distintas configuraciones de proceso/hilos.