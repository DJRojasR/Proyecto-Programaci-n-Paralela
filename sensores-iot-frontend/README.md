# Interfaz Web — Ciudad Inteligente / Sensores IoT

Interfaz de visualización en tiempo real para el proyecto de simulación
paralela masiva de sensores IoT. Esta parte corresponde solo al bloque
**INTERFAZ GRÁFICA** de la arquitectura del documento; el simulador
(MPI + Pthreads/OpenMP) y el broker MQTT son componentes aparte.

## Estructura del proyecto

```
sensores-iot-frontend/
├── index.html                  # Shell de la página, monta todos los paneles
├── css/
│   ├── variables.css           # Tokens: color, tipografía, espaciado
│   └── main.css                # Layout y estilos de componentes
├── js/
│   ├── config.js                # Constantes: broker, tópico, umbrales visuales
│   ├── main.js                  # Punto de entrada: conecta todos los módulos
│   ├── models/
│   │   ├── Sensor.js             # Un sensor individual (id, x, y, temp, humedad...)
│   │   └── Ciudad.js             # Colección de sensores + agregados
│   ├── mqtt/
│   │   └── MQTTClient.js         # Cliente MQTT sobre WebSockets
│   ├── render/
│   │   ├── shaders.js            # Shaders GLSL (vertex + fragment)
│   │   └── WebGLRenderer.js      # Dibuja la nube de sensores en un solo draw call
│   ├── state/
│   │   └── SensorStateManager.js # Calcula throughput, latencia, pérdida
│   └── ui/
│       ├── MetricsPanel.js       # Tarjetas de métricas (topbar + sidebar)
│       ├── Legend.js             # Leyenda de colores
│       └── ControlPanel.js       # Formulario de conexión al broker
└── assets/                      # (vacío por ahora — iconos/fuentes locales si se necesitan)
```

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
- ✅ Renderer WebGL listo para 10k–1M puntos sin generar datos falsos.
- ✅ Cliente MQTT real (usa `mqtt.js`), pero **no se conecta solo**:
  se dispara desde el botón "Conectar" del panel lateral, apuntando
  a un broker con listener WebSocket (ej. Mosquitto en `ws://host:9001`).
- ⛔ Sin simulador todavía: mientras no haya un broker real publicando
  en el tópico `ciudad/sensores/medicion`, la interfaz se queda en su
  estado vacío ("Esperando conexión MQTT").
- ⛔ MPI/Pthreads/OpenMP: fuera de este entregable, van en el simulador
  en C/C++ aparte.

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