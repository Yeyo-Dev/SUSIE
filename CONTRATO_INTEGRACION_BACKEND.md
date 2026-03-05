# 📡 Contrato de Integración: Frontend (SUSIE) ↔ Backend

Este documento define los endpoints que el **Backend** debe implementar para recibir la evidencia del examen (Audio y Snapshots) enviada por el Frontend.

> **Nota para Backend:** Actualmente existen endpoints WebSocket (`/api/monitoreo/audio`, `/api/monitoreo/video`). Se requiere **migrar o agregar** soporte para **HTTP POST** (`multipart/form-data`) para mejorar la escalabilidad y compatibilidad con la arquitectura de eventos.

---

## 1. Envío de Audio (Chunks)

El frontend graba audio en segmentos pequeños (chunks) y los envía periódicamente (cada **15 segundos**).
*Nota: Se usan 15 segundos porque modelos como Whisper son imprecisos con fragmentos muy cortos.*

- **Endpoint:** `POST /susie/api/v1/monitoreo/evidencias/audios`
- **Content-Type:** `multipart/form-data`

### 📥 Request Body (FormData)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `meta` | `JSON String` | Metadatos básicos de identificación cruzada. |
| `payload_info` | `JSON String` | Información y detalles extra sobre el chunk enviado. |
| `file` | `File` (Blob) | El archivo de audio. Formato: **WebM (Opus)**. |

> [!IMPORTANT]
> El orden en el que se envían los campos dentro del FormData es **ESTRICTO**. El campo `file` **SIEMPRE DEBE LLEGAR AL FINAL** (después de `meta` y `payload_info`), o el backend rechazará la petición con un error 400.

**Esquema JSON de `meta`:**
```json
{
  "correlation_id": "sess_abc", // ID de la sesión única
  "exam_id": "12345",          // ID del examen
  "student_id": "user_789",    // ID del estudiante
  "timestamp": "2026-02-19T10:00:00Z",
  "source": "frontend_client_v1"
}
```

**Esquema JSON de `payload_info`:**
```json
{
  "chunk_index": 1,            // Secuencia del chunk (0, 1, 2...)
  "type": "AUDIO_CHUNK"
}
```

### 📤 Response

- **200 OK**: Recibido y puesto en cola.
- **400 Bad Request**: El orden de los parámetros es incorrecto.
- **500 Error**: Fallo al procesar.

---

## 2. Envío de Snapshots (Fotos / Video)

El frontend toma fotos de la cámara periódicamente o cuando detecta anomalías.

- **Endpoint:** `POST /susie/api/v1/monitoreo/evidencias/snapshots`
- **Content-Type:** `multipart/form-data`

### 📥 Request Body (FormData)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `meta` | `JSON String` | Metadatos básicos de identificación cruzada. |
| `payload_info` | `JSON String` | Información técnica del snapshot. |
| `file` | `File` (Blob) | La foto capturada. Formato: **JPEG (`image/jpeg`)**. Calidad recomendada: 0.8. |

> [!IMPORTANT]
> Al igual que el audio, el campo `file` debe mandarse **al final**.

**Esquema JSON de `payload_info`:**
```json
{
  "type": "SNAPSHOT",          // Tipo de evento
  "trigger": "PERIODIC",       // "PERIODIC" | "TAB_SWITCH" | "FACE_MISSING"
  "browser_focus": true        // Si el usuario tenía el foco en la pestaña
}
```

### 📤 Response

- **200 OK**: Evidencia guardada.

---

## 3. Envío de Eventos del Navegador (Anomalías Lógicas)

El frontend también rastrea eventos lógicos (sin archivo multimedia) que son determinantes para el cálculo final de probabilidad de fraude (Motor de Inferencia).

- **Endpoint:** `POST /susie/api/v1/monitoreo/evidencias/eventos`
- **Content-Type:** `application/json`

### 📥 Request Body (JSON)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `meta` | `Object` | Metadatos básicos (mismos que en Audio/Snapshots). |
| `payload_info` | `Object` | Detalles del evento lógíco. |

**Esquema de Ejemplo:**
```json
{
  "meta": {
    "correlation_id": "sess_abc",
    "exam_id": "12345",
    "student_id": "user_789",
    "timestamp": "2026-02-19T10:05:00Z"
  },
  "payload_info": {
    "type": "BROWSER_EVENT",
    "trigger": "TAB_SWITCH", // "LOSS_FOCUS" | "DEVTOOLS_OPENED" | "FULLSCREEN_EXIT"
    "duration_seconds": 12 // Cuánto duró la anomalía (opcional)
  }
}
```

### 📤 Response

- **200 OK**: Evento registrado.

---

## 4. Eventos de Sesión (Start/End)

El frontend notifica al backend cuando el monitoreo de un examen inicia y finaliza (ya sea por envío regular o porque el usuario cierra/cancela).

> [!IMPORTANT]
> El Endpoint de `end` usa *keepalive* para garantizar su envío incluso si el navegador se está cerrando, por lo que el backend debe responder rápidamente.

### 4.1 Inicio de Sesión
- **Endpoint:** `POST /susie/api/v1/monitoreo/sesiones/start`
- **Content-Type:** `application/json`

**Esquema JSON:**
```json
{
  "examSessionId": "sess_eval_42_1708456789",
  "examId": "12345",
  "userId": "user_789",
  "timestamp": "2026-02-23T18:00:00.000Z"
}
```

### 4.2 Fin de Sesión
- **Endpoint:** `POST /susie/api/v1/monitoreo/sesiones/end`
- **Content-Type:** `application/json`

**Esquema JSON:**
```json
{
  "examSessionId": "sess_eval_42_1708456789",
  "status": "submitted", // "submitted" | "cancelled"
  "timestamp": "2026-02-23T19:30:00.000Z"
}
```

---

## 5. Ejemplo de Implementación (Fastify)

Para que el backend pueda recibir los archivos multimedia, debe usar `@fastify/multipart`.

```typescript
// En audio.routes.ts (o controller)

fastify.post('/audio', async (req, reply) => {
    const data = await req.file(); // Requiere @fastify/multipart
    
    // 1. Acceder al archivo
    const buffer = await data.toBuffer();
    
    // 2. Acceder a metadatos
    // Nota: en multipart, los campos vienen como partes. 
    // Si envías 'metadata' como field, fastify-multipart lo maneja.
    const metadata = JSON.parse(data.fields.metadata.value);

    // 3. Procesar (Guardar en disco / Enviar a RabbitMQ)
    await producerService.publish('audio_analysis_queue', { ...metadata, audio: buffer });

    return { status: 'ok' };
});
```

---

## 6. Canal de Feedback Asíncrono (WebSocket)

El frontend abre una conexión WebSocket **exclusiva para recibir alertas** de la IA (YOLO, Whisper, etc.) en tiempo real. El canal **NO** se usa para enviar evidencia — solo para escuchar.

- **Endpoint:** `ws://<backend-domain>/susie/api/v1/monitoreo/feedback`
- **Query Params:** `?session_id=<examSessionId>`
- **Dirección:** Unidireccional (Server → Client)

### 📤 Mensajes del Servidor al Cliente (JSON)

```json
{
  "type": "WARNING",        // "WARNING" | "CRITICAL" | "INFO"
  "msg": "Múltiples rostros detectados en cámara",
  "timestamp": "2026-02-23T19:05:12.000Z"
}
```

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `type` | `string` | Severidad de la alerta: `WARNING` (advertencia), `CRITICAL` (bloqueante), `INFO` (informativa). |
| `msg` | `string` | Mensaje legible para el candidato. |
| `timestamp` | `string` (ISO 8601) | Momento en que se detectó la anomalía (opcional). |

### Ciclo de Vida

1. El frontend abre el socket al entrar en la fase `MONITORING` (examen activo).
2. El backend puede enviar N mensajes JSON durante la sesión.
3. El frontend cierra el socket con código `1000` al finalizar el examen.

> [!NOTE]
> Si la conexión se cae (código 1006), el frontend reintentará la reconexión con backoff exponencial (1s, 2s, 4s... hasta 30s, máximo 8 intentos).
