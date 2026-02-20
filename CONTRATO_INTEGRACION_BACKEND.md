# 📡 Contrato de Integración: Frontend (SUSIE) ↔ Backend

Este documento define los endpoints que el **Backend** debe implementar para recibir la evidencia del examen (Audio y Snapshots) enviada por el Frontend.

> **Nota para Backend:** Actualmente existen endpoints WebSocket (`/api/monitoreo/audio`, `/api/monitoreo/video`). Se requiere **migrar o agregar** soporte para **HTTP POST** (`multipart/form-data`) para mejorar la escalabilidad y compatibilidad con la arquitectura de eventos.

---

## 1. Envío de Audio (Chunks)

El frontend graba audio en segmentos pequeños (chunks) y los envía periódicamente.

- **Endpoint:** `POST /api/monitoreo/audio`
- **Content-Type:** `multipart/form-data`

### 📥 Request Body (FormData)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `file` | `File` (Blob) | El archivo de audio. Formato: **WebM (Opus)**. |
| `metadata` | `JSON String` | Metadatos del chunk. Ver esquema abajo. |

**Esquema JSON de `metadata`:**
```json
{
  "exam_id": "12345",          // ID del examen
  "student_id": "user_789",    // ID del estudiante
  "examSessionId": "sess_abc", // ID de la sesión única
  "timestamp": "2026-02-19T10:00:00Z",
  "chunk_index": 1,            // Secuencia del chunk (0, 1, 2...)
  "source": "frontend_client_v1"
}
```

### 📤 Response

- **200 OK**: Recibido y puesto en cola.
- **500 Error**: Fallo al procesar.

---

## 2. Envío de Snapshots (Fotos / Video)

El frontend toma fotos de la cámara periódicamente o cuando detecta anomalías.

- **Endpoint:** `POST /api/monitoreo/video` (o `/api/evidence` si se quiere unificar)
- **Content-Type:** `multipart/form-data`

### 📥 Request Body (FormData)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `file` | `File` (Blob) | La foto capturada. Formato: **JPEG (`image/jpeg`)**. Calidad recomendada: 0.8. |
| `metadata` | `JSON String` | Metadatos de la evidencia. |

**Esquema JSON de `metadata`:**
```json
{
  "exam_id": "12345",
  "student_id": "user_789",
  "examSessionId": "sess_abc",
  "timestamp": "2026-02-19T10:05:00Z",
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
