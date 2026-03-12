# SUSIE — Contratos de Entrada/Salida de Workers e IA Biométrica

> Documento de referencia técnica para el equipo de integración. Describe las colas RabbitMQ, formatos JSON y endpoints REST de cada componente de IA.

---

## Diagrama General de Flujo

```
Backend (.NET)
  │
  ├─ Publica en ──► q_snapshots ──► Worker YOLO Vision ──► q_infracciones ──┐
  ├─ Publica en ──► q_audios    ──► Worker Audio Whisper ─► q_infracciones ──┤
  ├─ Publica en ──► q_gaze      ──► Worker Gaze Tracking ─► q_infracciones ──┤
  │                                                                           │
  │                                                         Inference Engine ◄┘
  │                                                         (consume q_infracciones)
  │
  └─ HTTP POST ──► Biometric API (FastAPI)
                   ├─ POST /api/vectorize
                   └─ POST /api/compare
```

---

## 1. Workers de IA (RabbitMQ)

Todos los workers siguen la misma arquitectura:

| Aspecto | Detalle |
|---------|---------|
| **Broker** | RabbitMQ (pika, `BlockingConnection`) |
| **Cola de salida** | `q_infracciones` (durable) |
| **Delivery mode** | Persistente (`delivery_mode=2`) |
| **Content-Type** | `application/json` |
| **Prefetch** | `prefetch_count=1` |
| **Retry** | Exponential backoff (5s → 60s máx) |

---

### 1.1 Worker de Visión — YOLOv8 Nano

| | |
|---|---|
| **Cola de entrada** | `q_snapshots` (durable) |
| **Cola de salida** | `q_infracciones` |
| **Archivos** | `ai_models/vision_yolo/main.py`, `worker.py`, `soft_evidence.py` |

#### Entrada — JSON consumido de `q_snapshots`

```json
{
  "user_id":     "string — ID del estudiante",
  "sesion_id":   "string — ID de la sesión de examen",
  "url_storage": "string — URL de la imagen en Azure Blob Storage"
}
```

#### Salida — JSON publicado en `q_infracciones`

```json
{
  "timestamp":     "2026-03-11T18:30:00.000000+00:00",
  "user_id":       "string",
  "sesion_id":     "string",
  "source":        "yolo_vision",
  "evidence_type": "soft",
  "soft_evidence": {
    "Normal":           0.10,
    "Ausente":          0.05,
    "Objeto_Prohibido": 0.80,
    "Multitud":         0.05
  },
  "details": {
    "persons_detected":  1,
    "phones_detected":   1,
    "phone_confidence":  0.85,
    "flags":             ["phone_detected"]
  }
}
```

> **Estados del nodo Visión:** `Normal` · `Ausente` · `Objeto_Prohibido` · `Multitud`
>
> **Normalización:** L1 con ε = 0.02 (Regla de Cromwell). Σ = 1.0 garantizado.

---

### 1.2 Worker de Audio — Faster-Whisper + NLP Semántico

| | |
|---|---|
| **Cola de entrada** | `q_audios` (durable) |
| **Cola de salida** | `q_infracciones` |
| **Archivos** | `ai_models/audio_whisper/main.py`, `worker.py`, `soft_evidence.py` |

#### Entrada — JSON consumido de `q_audios`

```json
{
  "user_id":     "string — ID del estudiante",
  "sesion_id":   "string — ID de la sesión de examen",
  "url_storage": "string — URL del chunk de audio en Azure Blob Storage"
}
```

#### Salida — JSON publicado en `q_infracciones`

**Caso Silencio (RMS < −45 dB):**

```json
{
  "timestamp":     "2026-03-11T18:30:00.000000+00:00",
  "user_id":       "string",
  "sesion_id":     "string",
  "source":        "audio_nlp",
  "evidence_type": "soft",
  "soft_evidence": {
    "Silencio":   0.97,
    "Neutral":    0.01,
    "Domestico":  0.01,
    "Sospechoso": 0.01
  },
  "details": {
    "transcript":       null,
    "silence_detected": true
  }
}
```

**Caso Voz Detectada:**

```json
{
  "timestamp":     "2026-03-11T18:30:00.000000+00:00",
  "user_id":       "string",
  "sesion_id":     "string",
  "source":        "audio_nlp",
  "evidence_type": "soft",
  "soft_evidence": {
    "Silencio":   0.02,
    "Neutral":    0.15,
    "Domestico":  0.60,
    "Sospechoso": 0.23
  },
  "details": {
    "transcript":       "pásame la respuesta de la pregunta 3",
    "silence_detected": false
  }
}
```

> **Estados del nodo Audio:** `Silencio` · `Neutral` · `Domestico` · `Sospechoso`
>
> **Normalización:** Softmax con Temperature Scaling (T = 1.5 por defecto). Σ = 1.0 garantizado.

---

### 1.3 Worker de Gaze Tracking — MediaPipe + DBSCAN + Isolation Forest

| | |
|---|---|
| **Cola de entrada** | `q_gaze` (durable) |
| **Cola de salida** | `q_infracciones` |
| **Archivos** | `ai_models/gaze_mediapipe/main.py`, `worker.py`, `soft_evidence.py` |

#### Entrada — JSON consumido de `q_gaze`

```json
{
  "user_id":     "string — ID del estudiante",
  "sesion_id":   "string — ID de la sesión de examen",
  "gaze_buffer": [
    [0.52, 0.48],
    [0.53, 0.47],
    [0.80, 0.20]
  ]
}
```

> **Nota:** `gaze_buffer` es una lista de coordenadas `[x, y]` normalizadas. Mínimo 15 frames requeridos (configurable vía `GAZE_MIN_BUFFER_SIZE`).

#### Salida — JSON publicado en `q_infracciones`

```json
{
  "timestamp":     "2026-03-11T18:30:00.000000+00:00",
  "user_id":       "string",
  "sesion_id":     "string",
  "source":        "gaze_tracker",
  "evidence_type": "soft",
  "soft_evidence": {
    "Concentrado":         0.65,
    "Fuera_de_Pantalla":   0.15,
    "Atencion_Secundaria": 0.10,
    "Erratico":            0.10
  },
  "details": {
    "oob_ratio":               0.15,
    "secondary_cluster_ratio": 0.10,
    "anomaly_ratio":           0.10
  }
}
```

> **Estados del nodo Mirada:** `Concentrado` · `Fuera_de_Pantalla` · `Atencion_Secundaria` · `Erratico`
>
> **Normalización:** Pesos relativos + L1 con ε = 0.02. Σ = 1.0 garantizado.

---

## 2. Formato Universal de Soft Evidence (resumen)

Todos los workers publican en `q_infracciones` con esta estructura común:

```json
{
  "timestamp":     "ISO 8601 UTC",
  "user_id":       "string",
  "sesion_id":     "string",
  "source":        "yolo_vision | audio_nlp | gaze_tracker",
  "evidence_type": "soft",
  "soft_evidence": { "Estado1": 0.xx, "Estado2": 0.xx, ... },
  "details":       { ... }
}
```

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `timestamp` | `string` | Fecha-hora ISO 8601 en UTC |
| `user_id` | `string` | Identificador del estudiante |
| `sesion_id` | `string` | Identificador de la sesión de examen |
| `source` | `string` | Worker que generó la evidencia |
| `evidence_type` | `string` | Siempre `"soft"` |
| `soft_evidence` | `object` | Distribución de probabilidad (Σ = 1.0) |
| `details` | `object` | Metadatos crudos específicos del worker |

---

## 3. Servicio Biométrico — API REST (FastAPI)

| | |
|---|---|
| **Protocolo** | HTTP REST (no usa RabbitMQ) |
| **Framework** | FastAPI + Uvicorn |
| **Puerto** | `8000` (configurable vía `API_PORT`) |
| **Archivos** | `ai_models/biometric_deepface/main.py`, `biometrics.py` |
| **Modelo IA** | face_recognition (dlib HOG) — embedding de 128 dims |

---

### 3.1 `POST /api/vectorize` — Generar Embedding Facial

Recibe una imagen de registro y retorna el vector facial para que el backend lo almacene en su BD.

#### Request Body

```json
{
  "image_url": "string — URL de la imagen en Azure Blob Storage"
}
```

#### Response — 200 OK

```json
{
  "face_detected": true,
  "embedding":     [0.0234, -0.0891, 0.1456, "... (128 floats)"],
  "dimensions":    128
}
```

#### Errores

| Código | Escenario |
|--------|-----------|
| `400` | No se pudo descargar o decodificar la imagen |
| `422` | No se detectó un rostro claro en la imagen |

---

### 3.2 `POST /api/compare` — Comparar Rostros

Compara una nueva foto contra el embedding guardado en la BD del backend.

#### Request Body

```json
{
  "image_url": "string — URL de la nueva foto (Azure Blob)",
  "vector_db": [0.0234, -0.0891, "... (128 floats)"],
  "umbral":    0.5
}
```

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `image_url` | `string` | ✅ | URL de la nueva imagen |
| `vector_db` | `float[128]` | ✅ | Embedding almacenado en BD |
| `umbral` | `float` | ❌ (default: `0.5`) | Distancia máxima para match |

#### Response — 200 OK

```json
{
  "is_match":           true,
  "similarity_percent": 87.35,
  "distance":           0.1265
}
```

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `is_match` | `bool` | `true` si `distance < umbral` |
| `similarity_percent` | `float` | `max(0, (1 − distance)) × 100` |
| `distance` | `float` | Distancia euclidiana entre embeddings [0, ~1.2] |

#### Errores

| Código | Escenario |
|--------|-----------|
| `400` | Vector de BD no tiene 128 dimensiones, o imagen no descargable |
| `422` | No se detectó rostro en la nueva imagen |

---

### 3.3 `GET /` — Health Check

```json
{
  "status":  "online",
  "service": "Biometric AI (Stateless)"
}
```

---

## 4. Mapa de Colas RabbitMQ

| Cola | Productor | Consumidor | Durable |
|------|-----------|------------|---------|
| `q_snapshots` | Backend (.NET) | Worker YOLO Vision | ✅ |
| `q_audios` | Backend (.NET) | Worker Audio Whisper | ✅ |
| `q_gaze` | Backend (.NET) | Worker Gaze Tracking | ✅ |
| `q_infracciones` | Workers YOLO / Audio / Gaze | Inference Engine | ✅ |

---

## 5. Variables de Entorno Relevantes

| Variable | Worker | Default | Descripción |
|----------|--------|---------|-------------|
| `RABBITMQ_HOST` | Todos | `localhost` | Host del broker RabbitMQ |
| `AUDIO_SILENCE_THRESHOLD_DB` | Audio | `-45` | Umbral de silencio (dB RMS) |
| `AUDIO_SOFTMAX_TEMPERATURE` | Audio | `1.5` | Temperatura del Softmax |
| `GAZE_MIN_BUFFER_SIZE` | Gaze | `15` | Frames mínimos por buffer |
| `API_HOST` | Biometric | `0.0.0.0` | Host del servidor FastAPI |
| `API_PORT` | Biometric | `8000` | Puerto del servidor FastAPI |
| `ALLOWED_ORIGINS` | Biometric | `*` | Orígenes CORS permitidos |
