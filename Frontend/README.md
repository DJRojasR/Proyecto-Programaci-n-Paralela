# Interfaz Web — Ciudad Inteligente / Sensores IoT

Interfaz de visualización en tiempo real para el proyecto de simulación
paralela masiva de sensores IoT. Esta parte corresponde solo al bloque
**INTERFAZ GRÁFICA** de la arquitectura del documento; el simulador
(MPI + Pthreads/OpenMP) y el broker MQTT son componentes aparte.

## Estructura del proyecto

```
sensores-iot-frontend/
├── index.html                    # Página principal; estructura base de la interfaz
│
├── css/
│   ├── variables.css             # Variables globales (colores, tipografía, espaciado, tema)
│   └── main.css                  # Estilos generales, layout y componentes de la interfaz
│
├── js/
│   ├── config.js                 # Configuración global (broker MQTT, tópicos, constantes y parámetros)
│   ├── main.js                   # Punto de entrada; inicializa la aplicación y conecta todos los módulos
│   │
│   ├── models/
│   │   ├── Sensor.js             # Modelo de un sensor IoT (id, posición, temperatura, humedad, estado, etc.)
│   │   └── Ciudad.js             # Gestiona la colección de sensores y el estado global de la ciudad
│   │
│   ├── mqtt/
│   │   └── MQTTClient.js         # Cliente MQTT mediante WebSockets; conexión, suscripción y recepción de mensajes
│   │
│   ├── mock/
│   │   └── SimuladorSensores.js  # Genera datos simulados para probar la interfaz sin el simulador MPI
│   │
│   ├── render/
│   │   ├── shaders.js            # Shaders GLSL (Vertex y Fragment) utilizados por WebGL
│   │   └── WebGLRenderer.js      # Renderiza la ciudad y la nube de sensores utilizando WebGL
│   │
│   ├── state/
│   │   └── SensorStateManager.js # Administra el estado de los sensores y calcula métricas (throughput, latencia, pérdida, etc.)
│   │
│   └── ui/
│       ├── MetricsPanel.js       # Actualiza y muestra las tarjetas de métricas
│       ├── Legend.js             # Renderiza la leyenda de estados y colores de los sensores
│       └── ControlPanel.js       # Panel de conexión y configuración del broker MQTT
│
└── assets/                       # Recursos estáticos (iconos, imágenes, fuentes, logos, etc.)

## Cómo correrlo

Es HTML/JS puro con módulos ES (`type="module"`), así que necesita
servirse por HTTP (no `file://`) por las reglas de CORS de los
módulos. Cualquiera de estas opciones funciona:

```bash
# Opción 1: servidor simple de Python
cd sensores-iot-frontend
python3 -m http.server 8080

# Opción 2: extensión Live Server de VS Code
```

Luego abrir `http://localhost:8080`.

## Estado actual

- ✅ Estructura y clases completas (modelo, render, MQTT, UI, métricas).
- ✅ Renderer WebGL listo para 10k–1M puntos.
- ✅ Cliente MQTT real (usa `mqtt.js`), pero **no se conecta solo**:
  se dispara desde el botón "Conectar" del panel "Conexión MQTT (real)",
  apuntando a un broker con listener WebSocket (ej. Mosquitto en
  `ws://host:9001`).
- ✅ Generador de datos ficticios (`SimuladorSensores.js`) para probar
  la interfaz sin depender de un broker ni del simulador en C/MPI.
  Se activa desde el panel "Datos ficticios (sin MPI)" en la sidebar,
  con la cantidad de sensores que quieras. Emite mensajes con la misma
  forma que un mensaje MQTT real, así que el resto de la app (Ciudad,
  render, métricas) no distingue si el dato vino de ahí o del broker.
- ⛔ MPI/Pthreads/OpenMP: fuera de este entregable, van en el simulador
  en C/C++ aparte. Cuando ese simulador publique al broker real, basta
  con usar el panel "Conexión MQTT (real)" en vez del de datos ficticios.

## Formato de mensaje esperado (tópico `ciudad/sensores/medicion`)

```json
{
  "sensor_id": "sensor_000123",
  "x": 245,
  "y": 180,
  "temperature": 24.7,
  "humidity": 61.3,
  "timestamp": 1717450000
}
```

Nota: se usó el modelo `x, y` de la sección 3 del documento (coordenadas
de ciudad) en vez de `lat, lon` del mockup, porque es el que trae el
resto de la especificación (rangos de sensores por zona, JSON de
ejemplo). Si el simulador termina usando `lat, lon`, el único archivo
que hay que tocar es `Ciudad.aplicarMedicion()`.

## Próximos pasos sugeridos

1. Levantar un broker Mosquitto local con listener WebSocket y probar
   la conexión real desde el panel de control.
2. Cuando el simulador (C/C++, MPI/Pthreads) esté listo, apuntar el
   tópico y verificar que los puntos se enciendan en el mapa.
3. Completar CPU/Memoria/Conexiones MQTT activas en el status bar
   (hoy son placeholders `—`), cuando el colector exponga esos datos.
