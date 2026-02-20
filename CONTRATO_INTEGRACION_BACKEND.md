# 📡 Contrato de Integración: Frontend (SUSIE) ↔ Backend

Este documento define los endpoints que el **Backend** debe implementar para recibir la evidencia del examen (Audio y Snapshots) enviada por el Frontend.

> **Nota para Backend:** Actualmente existen endpoints WebSocket (`/api/monitoreo/audio`, `/api/monitoreo/video`). Se requiere **migrar o agregar** soporte para **HTTP POST** (`multipart/form-data`) para mejorar la escalabilidad y compatibilidad con la arquitectura de eventos.

---

## 1. Envío de Audio (Chunks)

El frontend graba audio en segmentos pequeños (chunks) y los envía periódicamente (cada 15 segundos).

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

## 3. Ejemplo de Implementación (Fastify)

Para que el backend pueda recibir estos archivos, debe usar `@fastify/multipart`.

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
