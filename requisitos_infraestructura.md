# 🖥️ Requisitos Mínimos de Infraestructura — SUSIE

> Análisis basado en el stack completo del proyecto: AI Workers, Backend, Frontend, Inference Engine e infraestructura Docker.

---

## 1. Inventario de Servicios

| # | Servicio | Tecnología | Ejecuta como |
|---|----------|-----------|--------------|
| 1 | **RabbitMQ** | Erlang (imagen custom) | Contenedor Docker |
| 2 | **PostgreSQL** | PostgreSQL (imagen custom) | Contenedor Docker |
| 3 | **Redis** | Redis Alpine | Contenedor Docker |
| 4 | **Backend API** | Node.js 20 + Fastify + Prisma | Contenedor o proceso |
| 5 | **Frontend** | Angular 17 + PrimeNG (build estático) | Servido por Nginx o CDN |
| 6 | **Whisper Worker** | Python 3.10 + PyTorch (CPU) + faster-whisper + SentenceTransformers | Contenedor Docker |
| 7 | **YOLO Worker** | Python 3.10 + Ultralytics YOLOv8n + OpenCV | Contenedor Docker |
| 8 | **Gaze Worker** | Python 3.10 + NumPy + scikit-learn | Contenedor Docker |
| 9 | **DeepFace API** | Python 3.10 + face_recognition + dlib + FastAPI | Contenedor Docker |
| 10 | **Inference Engine** | Python 3.10 + pgmpy | Contenedor o proceso |

---

## 2. Consumo de Recursos por Servicio

### 🔴 Servicios pesados (AI Workers)

| Servicio | CPU (cores) | RAM | Disco (imagen + modelos) | Notas |
|----------|:-----------:|:---:|:------------------------:|-------|
| **Whisper Worker** | 2 | **2 GB** | ~4 GB | PyTorch CPU (~800 MB), faster-whisper base model (~300 MB), SentenceTransformers (~400 MB). El más pesado en RAM. |
| **YOLO Worker** | 2 | **2 GB** | ~3 GB | Ultralytics + YOLOv8n (~6 MB modelo, pero PyTorch subyacente ~800 MB). OpenCV headless. |
| **DeepFace API** | 2 | **2 GB** | ~3.5 GB | Imagen base `animcogn/face_recognition` incluye dlib precompilado (~1.5 GB). Modelo de embeddings se descarga en primer uso (~100 MB). |
| **Gaze Worker** | 1 | **1 GB** | ~0.5 GB | Solo NumPy + scikit-learn. Sin redes neuronales. El más ligero. |

### 🟡 Infraestructura (Middleware)

| Servicio | CPU (cores) | RAM | Disco |
|----------|:-----------:|:---:|:-----:|
| **RabbitMQ** | 1 | **512 MB** | ~200 MB |
| **PostgreSQL** | 1 | **512 MB** | ~500 MB (base) + crecimiento con datos |
| **Redis** | 0.5 | **256 MB** | ~50 MB |

### 🟢 Aplicación (Backend + Frontend)

| Servicio | CPU (cores) | RAM | Disco |
|----------|:-----------:|:---:|:-----:|
| **Backend (Fastify)** | 1 | **256 MB** | ~200 MB (`node_modules`) |
| **Frontend (Angular build)** | — | — | ~50 MB (estáticos). Build-time requiere ~1 GB RAM |
| **Inference Engine (pgmpy)** | 0.5 | **256 MB** | ~200 MB |

---

## 3. Cálculo de Requisitos Totales

### Escenario: Todos los servicios en un solo servidor

| Recurso | Mínimo absoluto | Recomendado |
|---------|:---------------:|:-----------:|
| **CPU** | **4 cores / 8 threads** | **8 cores / 16 threads** |
| **RAM** | **10 GB** | **16 GB** |
| **SSD** | **40 GB** (sistema + imágenes Docker) | **80 GB** (con margen para logs, modelos cache y datos PostgreSQL) |
| **Red** | 50 Mbps simétrico | 100 Mbps simétrico |
| **SO** | Ubuntu 22.04+ / Debian 12+ (Linux x86_64) | Ubuntu 24.04 LTS |

> [!IMPORTANT]
> **Los 10 GB de RAM son el piso duro.** El worker de Whisper solo (PyTorch + SentenceTransformers + faster-whisper) consume **~1.8 GB en reposo** y puede alcanzar **~2.5 GB bajo carga**. Más los otros 3 workers + infra, el sistema no arranca con menos de 10 GB.

> [!WARNING]
> **Sin GPU.** Todos los Dockerfiles y [requirements.txt](file:///c:/Users/Yeyo_/OneDrive/Documentos/GitHub/SUSIE/inference_engine/requirements.txt) usan PyTorch CPU (`--extra-index-url .../whl/cpu`). El sistema está diseñado para correr **sin tarjeta gráfica dedicada**. Esto es intencional por costo, pero implica que la inferencia en Whisper y YOLO es más lenta que con GPU.

---

## 4. Desglose del por qué de cada cifra

### CPU — 4 cores mínimo
- [docker-compose.yml](file:///c:/Users/Yeyo_/OneDrive/Documentos/GitHub/SUSIE/docker-compose.yml) ya asigna `cpus: '2'` a Whisper, YOLO y DeepFace.
- Los workers procesan mensajes con `prefetch=1` (secuencial por worker), pero hay **4 workers concurrentes**.
- RabbitMQ, PostgreSQL y Redis necesitan al menos 1 core compartido.
- Con 4 cores reales, habrá contención bajo carga simultánea. Con 8 se mantiene margen.

### RAM — 10 GB mínimo
```
Whisper Worker .... 2.0 GB
YOLO Worker ....... 2.0 GB
DeepFace API ...... 2.0 GB
Gaze Worker ....... 1.0 GB
RabbitMQ .......... 0.5 GB
PostgreSQL ........ 0.5 GB
Redis ............. 0.25 GB
Backend Fastify ... 0.25 GB
Inference Engine .. 0.25 GB
SO + Docker ....... 1.25 GB
─────────────────────────
TOTAL ............. ~10 GB
```

### SSD — 40 GB mínimo
```
Imágenes Docker (4 workers) . 15 GB
PostgreSQL data .............. 5 GB (creciente)
Redis data ................... 1 GB
RabbitMQ data ................ 1 GB
SO + Docker Engine ........... 10 GB
Logs y cache ................. 5 GB
Modelos AI (cache) ........... 3 GB
─────────────────────────────
TOTAL ........................ ~40 GB
```

> [!TIP]
> Se recomienda **SSD NVMe** sobre HDD. Los workers descargan archivos de Azure Blob Storage temporalmente al disco para procesarlos. Un HDD magnético crearía el cuello de botella I/O.

---

## 5. Almacenamiento Externo

| Servicio | Qué almacena | Ubicación |
|----------|-------------|-----------|
| **Azure Blob Storage** | Audio WebM (chunks 15s), Snapshots (imágenes), evidencias | **Nube Azure** (no consume disco local) |
| **PostgreSQL** | Usuarios, exámenes, preguntas, respuestas, sesiones, infracciones, biométricos | Local en el servidor |
| **Redis** | Eventos temporales de proctoring por sesión (`proctoring:session_{id}:user_{id}`) | En memoria (efímero) |

> [!NOTE]
> El almacenamiento pesado (videos, audios, imágenes) **NO se guarda en el servidor**. Se sube a Azure Blob Storage. El servidor solo descarga temporalmente para procesar y elimina después. Esto reduce drásticamente los requisitos de SSD.

---

## 6. Opciones de Hosting Recomendadas

### Opción A: VPS / VM en la nube (recomendado)

| Proveedor | Instancia equivalente | Specs | Costo aprox/mes |
|-----------|----------------------|-------|:---------------:|
| **Azure** | Standard_D4s_v3 | 4 vCPU, 16 GB RAM, SSD Premium | ~$140 USD |
| **AWS** | t3.xlarge | 4 vCPU, 16 GB RAM, EBS gp3 | ~$120 USD |
| **DigitalOcean** | Premium Intel 4vCPU | 4 vCPU, 16 GB RAM, 80 GB SSD | ~$96 USD |
| **Hetzner** | CPX41 | 8 vCPU, 16 GB RAM, 240 GB SSD | ~$26 EUR |

### Opción B: Servidor dedicado / On-premise

| Componente | Especificación mínima |
|------------|----------------------|
| **Procesador** | Intel i5-12400 / AMD Ryzen 5 5600 (6 cores/12 threads) o superior |
| **RAM** | 16 GB DDR4 3200 MHz (2×8 GB) |
| **Almacenamiento** | SSD NVMe 256 GB |
| **Red** | Conexión 100 Mbps simétrica con IP estática |
| **SO** | Ubuntu 22.04 LTS Server |

---

## 7. Consideraciones de Escalabilidad

| Escenario | Impacto | Estrategia |
|-----------|---------|------------|
| **10-50 exámenes simultáneos** | Config mínima aguanta | Servidor único |
| **50-200 exámenes simultáneos** | Workers saturan CPU y RAM | Escalar workers horizontalmente (réplicas Docker) |
| **200+ exámenes simultáneos** | Infraestructura se vuelve cuello de botella | Kubernetes / Docker Swarm + PostgreSQL gestionado + Redis cluster |

> [!TIP]
> La arquitectura event-driven de SUSIE (RabbitMQ + workers stateless con `prefetch=1`) fue diseñada precisamente para escalar horizontalmente. Añadir más instancias de un worker es tan simple como lanzar más contenedores Docker del mismo servicio.

---

## 8. ¿Qué pasaría si se configura con GPU?

Actualmente todos los workers usan **PyTorch CPU** (`--extra-index-url .../whl/cpu`). Migrar a GPU aceleraría dramáticamente la inferencia de los modelos neuronales, pero cambia los requisitos de infraestructura por completo.

### Qué workers se benefician de GPU

| Worker | ¿Usa redes neuronales? | Ganancia con GPU | Speedup estimado |
|--------|:----------------------:|:----------------:|:----------------:|
| **Whisper** | ✅ faster-whisper (CTranslate2) + SentenceTransformers (PyTorch) | 🔥 **Altísima** | **5-10x** más rápido en transcripción |
| **YOLO** | ✅ YOLOv8n (PyTorch) | 🔥 **Alta** | **3-8x** más rápido en detección de objetos |
| **DeepFace** | ✅ dlib + modelos de embeddings | 🟡 **Moderada** | **2-4x** (dlib ya es eficiente en CPU) |
| **Gaze** | ❌ Solo NumPy + scikit-learn | ⚪ **Ninguna** | Sin cambio (no usa redes neuronales) |
| **Inference Engine** | ❌ pgmpy (tablas de probabilidad) | ⚪ **Ninguna** | Sin cambio |

> [!IMPORTANT]
> Solo **3 de 5 servicios de IA** se benefician de GPU. El Gaze Worker y el Inference Engine no la usarían en absoluto.

### Cambios técnicos necesarios

Para habilitar GPU en el proyecto, se necesitarían estos cambios:

**1. Dockerfiles — Cambiar imagen base:**
```dockerfile
# ANTES (CPU)
FROM python:3.10-slim

# DESPUÉS (GPU)
FROM nvidia/cuda:12.2.0-runtime-ubuntu22.04
```

**2. requirements.txt — PyTorch con CUDA:**
```diff
- torch --extra-index-url https://download.pytorch.org/whl/cpu
+ torch --extra-index-url https://download.pytorch.org/whl/cu121
```

**3. docker-compose.yml — Reservar GPU:**
```yaml
yolo-worker:
  deploy:
    resources:
      reservations:
        devices:
          - driver: nvidia
            count: 1
            capabilities: [gpu]
```

**4. Host — Instalar NVIDIA Container Toolkit:**
```bash
# Requerido para que Docker acceda a la GPU
sudo apt install nvidia-container-toolkit
sudo systemctl restart docker
```

### Requisitos de hardware con GPU

| Recurso | Mínimo con GPU | Recomendado con GPU |
|---------|:--------------:|:-------------------:|
| **GPU** | NVIDIA T4 (16 GB VRAM) | NVIDIA RTX 4060 (8 GB) / L4 (24 GB) |
| **VRAM** | **8 GB** | **16 GB** |
| **CPU** | 4 cores | 8 cores |
| **RAM del sistema** | **12 GB** | **16 GB** |
| **SSD** | **60 GB** (imágenes CUDA son más pesadas ~+15 GB) | **100 GB** |

> [!WARNING]
> Las imágenes Docker con CUDA pesan **~5 GB** cada una vs ~1 GB de `python:3.10-slim`. Esto suma **~15 GB extra** en disco solo por las imágenes base, y la instalación de PyTorch con CUDA agrega otros **~2 GB** por worker.

### Impacto en rendimiento: CPU vs GPU

| Tarea | Tiempo CPU | Tiempo GPU | Mejora |
|-------|:----------:|:----------:|:------:|
| Whisper: transcribir audio 15s | ~8-12 seg | ~1-2 seg | **6x** |
| YOLO: analizar 1 snapshot | ~200-400 ms | ~30-60 ms | **5x** |
| DeepFace: generar embedding | ~500 ms | ~150 ms | **3x** |
| SentenceTransformers: embedding texto | ~300 ms | ~50 ms | **6x** |

> [!TIP]
> El mayor beneficio está en **Whisper**. En CPU, transcribir un chunk de 15 segundos puede tomar hasta 12 segundos (casi en tiempo real). Con GPU, baja a ~1-2 segundos, lo que permite procesar backlog de audio mucho más rápido durante exámenes masivos.

### Opciones de hosting con GPU

| Proveedor | Instancia | GPU | Specs | Costo aprox/mes |
|-----------|----------|-----|-------|:---------------:|
| **Azure** | NC4as_T4_v3 | NVIDIA T4 (16 GB) | 4 vCPU, 28 GB RAM | ~$530 USD |
| **AWS** | g4dn.xlarge | NVIDIA T4 (16 GB) | 4 vCPU, 16 GB RAM | ~$380 USD |
| **Lambda Labs** | gpu_1x_a10 | NVIDIA A10 (24 GB) | 30 vCPU, 200 GB RAM | ~$220 USD |
| **Hetzner** | GEX44 | NVIDIA L40S (48 GB) | 12 vCPU, 64 GB RAM | ~$290 EUR |
| **RunPod** | Community GPU | RTX 4090 (24 GB) | 16 vCPU, 62 GB RAM | ~$300 USD |

### ¿Vale la pena? Análisis costo-beneficio

| Escenario | ¿GPU justificada? | Razón |
|-----------|:-----------------:|-------|
| **< 50 exámenes simultáneos** | ❌ No | CPU maneja la carga. El costo 3-4x mayor no se justifica. |
| **50-200 exámenes simultáneos** | 🟡 Depende | Si el cuello de botella es la velocidad de procesamiento de audio/video, sí. Si es la cantidad de colas, mejor escalar con más workers CPU. |
| **200+ exámenes simultáneos** | ✅ Sí | La GPU permite que **1 worker haga el trabajo de 5-8 workers CPU**, reduciendo la complejidad operativa. |
| **Modo batch (post-examen)** | ❌ No | Si no se necesita resultado en tiempo real, CPU es suficiente. |

> [!CAUTION]
> **El costo se multiplica ~3-4x** al pasar de CPU a GPU en la nube. Una VM CPU de ~$100/mes se convierte en ~$380-530/mes con GPU. Para un proyecto universitario/startup, la configuración CPU-only actual es la decisión correcta hasta que la escala lo demande.

---

## Resumen Ejecutivo

| Recurso | Solo CPU (actual) | Con GPU |
|---------|:-----------------:|:-------:|
| **CPU** | 4-8 cores | 4-8 cores |
| **RAM** | 10-16 GB | 12-16 GB |
| **SSD** | 40-80 GB NVMe | 60-100 GB NVMe |
| **GPU** | ❌ No requerida | NVIDIA T4 / RTX 4060+ (8+ GB VRAM) |
| **Red** | 50-100 Mbps | 50-100 Mbps |
| **Costo nube** | ~$96-140 USD/mes | ~$300-530 USD/mes |
| **SO** | Linux x86_64 | Linux x86_64 + NVIDIA drivers + Container Toolkit |
