# 🔗 Contrato de Integración: Backend ↔ AI Workers (v2)

> **De:** Equipo de IA
> **Para:** Equipo de Backend  
> **Fecha:** 2026-03-03  
> **Estado:** Los workers ya fueron adaptados a los campos del backend. Este documento lista lo que falta **del lado del backend**.

---

## ✅ Ya resuelto (lado IA)

- Los workers ahora leen `user_id`, `sesion_id`, `url_storage` — **coinciden** con lo que el backend publica.
- Los eventos de salida en `q_evidencias` usan `user_id` y `sesion_id`.
- La cola del gaze se renombró de `gaze_tasks_queue` a `q_gaze` para ser consistente con `q_snapshots` / `q_audios`.

---

## 🔴 1. Crear consumidor de `q_evidencias` (CRÍTICO)

Los 3 workers publican sus resultados en la cola `q_evidencias`. Actualmente **nadie consume esa cola**.

### Declarar la cola en `rabbitmq.ts`:
```typescript
await channel.assertQueue('q_evidencias', { durable: true });
```

### Formato de los mensajes:
```json
{
  "timestamp": "2026-03-03T22:00:00Z",
  "user_id": 123,
  "sesion_id": 456,
  "source": "yolo_vision | audio_nlp | gaze_tracker",
  "evidence_type": "soft",
  "soft_evidence": {
    "Estado1": 0.80,
    "Estado2": 0.10,
    "Estado3": 0.05,
    "Estado4": 0.05
  },
  "details": { ... }
}
```

> Los valores de `soft_evidence` **siempre suman 1.0**.

### Estados por source:

| source | Estados |
|--------|---------|
| `yolo_vision` | `Normal`, `Ausente`, `Objeto_Prohibido`, `Multitud` |
| `audio_nlp` | `Silencio`, `Neutral`, `Domestico`, `Sospechoso` |
| `gaze_tracker` | `Concentrado`, `Fuera_de_Pantalla`, `Atencion_Secundaria`, `Erratico` |

---

## 🔴 2. Declarar cola `q_gaze` + binding + productor

El worker de gaze consume de `q_gaze` pero el backend no la declara ni publica ahí.

### En `rabbitmq.ts` agregar:
```typescript
await channel.assertQueue('q_gaze', { durable: true });
await channel.bindQueue('q_gaze', EXCHANGE_NAME, 'stream.gaze');
```

### Crear servicio que acumule coordenadas de mirada y las publique:
```typescript
// Routing key: 'stream.gaze'
await broker.publish('stream.gaze', {
    sesion_id: metaData.sesion_id,
    user_id: metaData.usuario_id,
    gaze_buffer: [[0.5, 0.3], [0.51, 0.31], ...]  // mínimo 15 coordenadas
});
```

> El buffer debe tener **mínimo 15 coordenadas** (≈1.5s a 10fps). Si tiene menos, el worker lo ignora.

---

## 🟡 3. Subir archivos a Azure Blob Storage (en lugar de disco local)

Actualmente `snapshot.service.ts` y `audio.service.ts` guardan en disco y generan un `mockUrl`:
```typescript
const mockUrl = `https://mi-storage.blob.core.windows.net/evidencias/${nombreArchivo}`;
```

Los workers descargan de `url_storage` con `requests.get()` — esto va a fallar con la URL mock. Cuando se implemente la subida real a Azure, los workers ya están listos para descargar desde ahí.

---

## � 4. Integrar API biométrica

La API biométrica ahora es stateless con JSON body (ya no `Form`/`UploadFile`):

**`POST /api/vectorize`** (Registro)
```json
// Request
{ "image_url": "https://blob.../foto.jpg" }

// Response
{ "face_detected": true, "embedding": [0.012, -0.045, ...], "dimensions": 128 }
```

**`POST /api/compare`** (Validación)
```json
// Request
{ "image_url": "https://blob.../foto_nueva.jpg", "vector_db": [128 floats], "umbral": 0.5 }

// Response
{ "is_match": true, "similarity_percent": 87.34, "distance": 0.1266 }
```

---

## Resumen de acciones

| # | Acción | Responsable | Prioridad |
|---|--------|------------|-----------|
| 1 | Consumidor de `q_evidencias` | **Backend** | 🔴 Crítico |
| 2 | Declarar `q_gaze` + binding + productor | **Backend** | 🔴 Crítico |
| 3 | Subir a Azure Blob real (no mockUrl) | **Backend** | 🟡 Medio |
| 4 | Integrar endpoints biométricos | **Backend** | 🟢 Normal |
