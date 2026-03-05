# 📋 SUSIE Backend — Documentación de APIs

**Base URL:** `http://localhost:3000/susie/api/v1`  
**Content-Type por defecto:** `application/json`

---

## Índice
1. [Evaluaciones](#1-evaluaciones)
2. [Exámenes](#2-exámenes)
3. [Sesiones de Evaluación](#3-sesiones-de-evaluación)
4. [Biométricos](#4-biométricos)
5. [Monitoreo — Snapshots](#5-monitoreo--snapshots)
6. [Monitoreo — Audio](#6-monitoreo--audio)
7. [Monitoreo — Infracciones](#7-monitoreo--infracciones)

---

## 1. Evaluaciones

### `GET /evaluaciones/configuracion/:evaluacion_id`

Obtiene la configuración de una evaluación junto con el contexto del usuario asignado.

**Parámetros de URL**

| Param | Tipo | Descripción |
|---|---|---|
| `evaluacion_id` | `number` | ID de la evaluación |

**Respuesta exitosa `200`**
```json
{
  "success": true,
  "evaluacion": {
    "evaluacion": {
      "examen_id": "1",
      "examen_titulo": "Examen de Matemáticas",
      "duracion_minutos": 60,
      "asignacion_id": "10",
      "usuario_id": "5",
      "usuario_nombre": "Juan Pérez",
      "usuario_email": "juan@example.com"
    },
    "configuracion": {
      "analisis_mirada": true,
      "camara": true,
      "max_cambio_pestana": 3,
      "microfono": true,
      "tiempo_sin_inactividad": 120,
      "tolerancia_desconexion": 30,
      "validacion_biometrica": true
    }
  }
}
```

**Errores**

| Código | Causa |
|---|---|
| `400` | `evaluacion_id` no es un número válido |
| `404` | No existe la evaluación |
| `500` | Error interno |

**Ejemplo fetch**
```javascript
const res = await fetch(`${BASE_URL}/evaluaciones/configuracion/1`);
const data = await res.json();
// data.evaluacion.configuracion.camara → true/false
```

---

## 2. Exámenes

### `GET /examenes/:examen_id`

Obtiene los detalles del examen con todas sus preguntas y opciones de respuesta.

**Parámetros de URL**

| Param | Tipo | Descripción |
|---|---|---|
| `examen_id` | `number` | ID del examen |

**Respuesta exitosa `200`**
```json
{
  "success": true,
  "data": {
    "detalles": {
      "examen_id": "1",
      "titulo": "Examen Matemáticas",
      "descripcion": "Álgebra básica",
      "numero_de_preguntas": "10",
      "puntos_maximos": "100"
    },
    "preguntas": [
      {
        "pregunta_id": "1",
        "contenido": "¿Cuánto es 2 + 2?",
        "imagen": null,
        "opciones": ["2", "3", "4", "5"]
      }
    ]
  }
}
```

**Errores**

| Código | Causa |
|---|---|
| `400` | `examen_id` inválido |
| `404` | Examen no encontrado |
| `500` | Error interno |

**Ejemplo fetch**
```javascript
const res = await fetch(`${BASE_URL}/examenes/1`);
const { data } = await res.json();
// data.preguntas → array de preguntas con opciones
```

---

## 3. Sesiones de Evaluación

### `POST /sesiones/`

Inicia una nueva sesión de evaluación. El estado inicial es `EN_CURSO`.

**Body JSON**
```json
{
  "id_asignacion": 10
}
```

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `id_asignacion` | `number` | ✅ | ID de la asignación del examen al usuario |

**Respuesta exitosa `201`**
```json
{
  "id_sesion": "25",
  "id_asignacion": "10",
  "fecha_inicio": "2026-03-05T18:00:00.000Z",
  "fecha_fin": null,
  "estado_sesion": "EN_CURSO"
}
```

**Ejemplo fetch**
```javascript
const res = await fetch(`${BASE_URL}/sesiones`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ id_asignacion: 10 })
});
const sesion = await res.json();
// Guardar sesion.id_sesion para usarlo durante el monitoreo
```

---

### `POST /sesiones/finalizar/:id_sesion`

Finaliza una sesión activa. Cambia el estado a `FINALIZADA` y registra la `fecha_fin`.

**Parámetros de URL**

| Param | Tipo | Descripción |
|---|---|---|
| `id_sesion` | `number` | ID de la sesión a finalizar |

**Respuesta exitosa `200`**
```json
{
  "id_sesion": "25",
  "estado_sesion": "FINALIZADA",
  "fecha_fin": "2026-03-05T19:00:00.000Z"
}
```

**Ejemplo fetch**
```javascript
const res = await fetch(`${BASE_URL}/sesiones/finalizar/25`, {
  method: 'POST'
});
```

---

## 4. Biométricos

> **Content-Type:** `multipart/form-data`
> 
> ⚠️ **Orden obligatorio en FormData:** el campo `meta` debe enviarse **antes** que el archivo.

### `POST /usuarios/biometricos/`

Registra la foto de referencia biométrica del usuario.

**FormData**

| Campo | Tipo | Descripción |
|---|---|---|
| `meta` | `JSON string` | `{ "usuario_id": 5 }` |
| `file` | `File` (imagen) | Foto de referencia (máx 10MB) |

**Respuesta exitosa `201`**
```json
{
  "status": "success",
  "message": "Biométrico registrado correctamente",
  "data": { ... }
}
```

**Errores**

| Código | Causa |
|---|---|
| `400` | `meta` no enviado antes del archivo |
| `409` | El usuario ya tiene biométricos registrados |
| `500` | Error interno |

**Ejemplo fetch**
```javascript
const formData = new FormData();
formData.append('meta', JSON.stringify({ usuario_id: 5 }));
formData.append('file', imageBlob, 'foto.jpg');

await fetch(`${BASE_URL}/usuarios/biometricos`, {
  method: 'POST',
  body: formData
});
```

---

### `PUT /usuarios/biometricos/`

Actualiza la foto de referencia biométrica existente.

**FormData** — igual que el registro (`meta` + `file`)

**Respuesta exitosa `200`** — mismo shape que el registro

**Errores**

| Código | Causa |
|---|---|
| `404` | Usuario sin biométricos registrados |
| `400` | Formato de imagen no soportado |

---

### `POST /usuarios/biometricos/validar`

Valida una foto en tiempo real contra la referencia registrada.

**FormData** — igual: `meta` (con `usuario_id`) + `file` (foto actual)

**Respuesta exitosa `200`**
```json
{
  "status": "success",
  "confianza": 0.97,
  "validado": true
}
```

**Errores**

| Código | Causa |
|---|---|
| `404` | No hay biométricos registrados para el usuario |
| `401` | Validación fallida (no coincide) |

**Ejemplo fetch**
```javascript
const formData = new FormData();
formData.append('meta', JSON.stringify({ usuario_id: 5 }));
formData.append('file', capturedBlob, 'validacion.jpg');

const res = await fetch(`${BASE_URL}/usuarios/biometricos/validar`, {
  method: 'POST',
  body: formData
});
const { validado } = await res.json();
```

---

### `DELETE /usuarios/biometricos/:usuario_id`

Elimina todos los datos biométricos de un usuario.

**Parámetros de URL**

| Param | Tipo | Descripción |
|---|---|---|
| `usuario_id` | `number` | ID del usuario |

**Respuesta exitosa `200`**
```json
{
  "status": "success",
  "message": "Datos biométricos eliminados correctamente."
}
```

---

## 5. Monitoreo — Snapshots

### `POST /monitoreo/evidencias/snapshots`

Sube una imagen (frame de webcam o captura de pantalla) durante la sesión activa.

> **Content-Type:** `multipart/form-data` | Límite: **10 MB**
>
> ⚠️ **Orden obligatorio:** `meta` → `payload_info` → `file`

**FormData**

| Campo | Tipo | Descripción |
|---|---|---|
| `meta` | `JSON string` | Metadata del snapshot (ver estructura abajo) |
| `payload_info` | `JSON string` | Tipo y origen del snapshot |
| `file` | `File` (.jpg) | Imagen capturada |

**Estructura `meta`**
```json
{
  "sesion_id": 25,
  "usuario_id": 5,
  "nombre_usuario": "Juan Pérez",
  "examen_id": 1,
  "nombre_examen": "Examen Matemáticas",
  "timestamp": 1741200000000
}
```

**Estructura `payload_info`**
```json
{
  "type": "snapshot_webcam",
  "source": "web"
}
```
> `type`: `"snapshot_webcam"` | `"snapshot_pantalla"`  
> `source`: `"web"` | `"desktop"`

**Respuesta exitosa `200`**
```json
{
  "status": "success",
  "message": "Evidencia procesada correctamente",
  "data": {
    "filename": "examenmatematicas_juanperez_snapshotwebcam_1741200000.jpg",
    "url": "https://mi-storage.blob.core.windows.net/evidencias/...",
    "size": 204800,
    "meta": { ... },
    "info_tecnica": { ... }
  }
}
```

**Ejemplo fetch**
```javascript
const formData = new FormData();
formData.append('meta', JSON.stringify({
  sesion_id: 25, usuario_id: 5,
  nombre_usuario: 'Juan Pérez', examen_id: 1,
  nombre_examen: 'Examen Matemáticas',
  timestamp: Date.now()
}));
formData.append('payload_info', JSON.stringify({
  type: 'snapshot_webcam', source: 'web'
}));
formData.append('file', blob, 'snapshot.jpg');

await fetch(`${BASE_URL}/monitoreo/evidencias/snapshots`, {
  method: 'POST',
  body: formData
});
```

---

## 6. Monitoreo — Audio

### `POST /monitoreo/evidencias/audios`

Sube un fragmento de audio del micrófono durante la sesión activa.

> **Content-Type:** `multipart/form-data` | Límite: **5 MB**
>
> ⚠️ **Orden obligatorio:** `meta` → `payload_info` → `file`

**FormData**

| Campo | Tipo | Descripción |
|---|---|---|
| `meta` | `JSON string` | Metadata del fragmento (ver estructura) |
| `payload_info` | `JSON string` | Tipo y origen del audio |
| `file` | `File` (.webm) | Fragmento de audio |

**Estructura `meta`**
```json
{
  "sesion_id": "25",
  "usuario_id": 5,
  "nombre_usuario": "Juan Pérez",
  "examen_id": "1",
  "nombre_examen": "Examen Matemáticas",
  "timestamp": 1741200000000,
  "fragmento_indice": 1
}
```
> `fragmento_indice`: número secuencial del fragmento (para ordenarlos correctamente)

**Estructura `payload_info`**
```json
{
  "type": "audio_segment",
  "source": "microphone"
}
```
> `source`: `"microphone"` | `"webcam"`

**Respuesta exitosa `200`**
```json
{
  "status": "success",
  "message": "Fragmento de audio procesado correctamente",
  "data": {
    "filename": "examenmatematicas_juanperez_audiosegment_0001_1741200000.webm",
    "url": "https://mi-storage.blob.core.windows.net/audios/...",
    "size": 51200,
    "meta": { ... },
    "info_tecnica": { ... }
  }
}
```

**Ejemplo fetch**
```javascript
let fragmentoIndice = 0;
// Llamar periódicamente durante la sesión:
const formData = new FormData();
formData.append('meta', JSON.stringify({
  sesion_id: '25', usuario_id: 5,
  nombre_usuario: 'Juan Pérez', examen_id: '1',
  nombre_examen: 'Examen Matemáticas',
  timestamp: Date.now(),
  fragmento_indice: ++fragmentoIndice
}));
formData.append('payload_info', JSON.stringify({
  type: 'audio_segment', source: 'microphone'
}));
formData.append('file', audioBlob, 'audio.webm');

await fetch(`${BASE_URL}/monitoreo/evidencias/audios`, {
  method: 'POST',
  body: formData
});
```

---

## 7. Monitoreo — Infracciones

### `POST /monitoreo/infracciones/`

Registra una infracción detectada durante la sesión (puede ser llamado por el Worker IA o por lógica del frontend).

**Body JSON**
```json
{
  "id_sesion": 25,
  "minuto_infraccion": "00:05:30",
  "tipo_infraccion": "CAMBIO_DE_PESTAÑA",
  "detalles_infraccion": "El alumno cambió de pestaña 3 veces",
  "url_azure_evidencia": "https://mi-storage.blob.core.windows.net/evidencias/snap.jpg"
}
```

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `id_sesion` | `number` | ✅ | ID de la sesión activa |
| `minuto_infraccion` | `string` | ✅ | Tiempo en formato `"HH:MM:SS"` |
| `tipo_infraccion` | `enum` | ✅ | `"CAMBIO_DE_PESTAÑA"` \| `"USO_DE_TELEFONO"` \| `"OTRO"` |
| `detalles_infraccion` | `string` | ✅ | Descripción de la infracción |
| `url_azure_evidencia` | `string` | ❌ | URL de la evidencia relacionada (opcional) |

**Respuesta exitosa `201`**
```json
{
  "status": "success",
  "message": "Infracción registrada correctamente",
  "data": {
    "id_infraccion": "15",
    "id_sesion": "25",
    "minuto_infraccion": "00:05:30",
    "tipo_infraccion": "CAMBIO_DE_PESTAÑA",
    "detalles_infraccion": "El alumno cambió de pestaña 3 veces",
    "url_azure_evidencia": null
  }
}
```

**Errores**

| Código | Causa |
|---|---|
| `500` | Error al guardar en DB |

**Ejemplo fetch**
```javascript
// Detectar cambio de pestaña:
document.addEventListener('visibilitychange', async () => {
  if (document.hidden) {
    await fetch(`${BASE_URL}/monitoreo/infracciones`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id_sesion: 25,
        minuto_infraccion: '00:05:30',
        tipo_infraccion: 'CAMBIO_DE_PESTAÑA',
        detalles_infraccion: 'El alumno cambió de pestaña',
        url_azure_evidencia: null
      })
    });
  }
});
```

---

## Resumen de Endpoints

| Módulo | Método | Ruta | Estado |
|---|---|---|---|
| Evaluaciones | `GET` | `/evaluaciones/configuracion/:evaluacion_id` | ✅ Listo |
| Exámenes | `GET` | `/examenes/:examen_id` | ✅ Listo |
| Sesiones | `POST` | `/sesiones/` | ✅ Listo |
| Sesiones | `POST` | `/sesiones/finalizar/:id_sesion` | ✅ Listo |
| Biométricos | `POST` | `/usuarios/biometricos/` | ✅ Listo |
| Biométricos | `PUT` | `/usuarios/biometricos/` | ✅ Listo |
| Biométricos | `POST` | `/usuarios/biometricos/validar` | ✅ Listo (simulado) |
| Biométricos | `DELETE` | `/usuarios/biometricos/:usuario_id` | ✅ Listo |
| Snapshots | `POST` | `/monitoreo/evidencias/snapshots` | ✅ Listo |
| Audio | `POST` | `/monitoreo/evidencias/audios` | ✅ Listo |
| Infracciones | `POST` | `/monitoreo/infracciones/` | ✅ Listo |
