# Datos enviados al Motor de Inferencia (Backend)

Este documento detalla todos los datos y eventos que el frontend envía al backend durante una sesión de monitoreo proctoring. Estos datos son procesados por los motores de inferencia (YOLO, Whisper, algoritmos de detección de anomalías, etc.) para generar alertas y mapas de calor.

---

## 1. Infracciones (`POST /monitoreo/infracciones`)

Cuando se detecta un comportamiento anómalo en el navegador, se envía un registro detallando el evento.

**Payload:**
```json
{
  "id_sesion": 12345,
  "minuto_infraccion": "00:15:30",
  "tipo_infraccion": "CAMBIO_DE_PESTAÑA" | "OTRO",
  "detalles_infraccion": "Descripción del evento...",
  "url_azure_evidencia": null
}
```

**Tipos de Infracciones Detectadas:**

| Evento Frontend (`trigger`) | Tipo Backend (`tipo_infraccion`) | Detalles (`detalles_infraccion`) |
|-------------------------|--------------------------------|----------------------------------|
| `TAB_SWITCH`            | `CAMBIO_DE_PESTAÑA`            | El alumno cambió de pestaña |
| `LOSS_FOCUS`            | `CAMBIO_DE_PESTAÑA`            | El alumno perdió el foco de la ventana |
| `FULLSCREEN_EXIT`       | `OTRO`                         | El alumno salió de pantalla completa |
| `DEVTOOLS_OPENED`       | `OTRO`                         | El alumno intentó abrir herramientas de desarrollador |
| `NAVIGATION_ATTEMPT`    | `OTRO`                         | El alumno intentó navegar fuera de la página |
| `RELOAD_ATTEMPT`        | `OTRO`                         | El alumno intentó recargar la página |
| `CLIPBOARD_ATTEMPT`     | `OTRO`                         | El alumno intentó copiar/pegar |
| `GAZE_DEVIATION`        | `OTRO`                         | Se detectó desviación de la mirada del alumno |
| `FACE_LOSS_TIMEOUT`     | `OTRO`                         | El rostro no fue detectado por un periodo superior al permitido |

---

## 2. Gaze Tracking (`POST /monitoreo/evidencias/gaze_tracking`)

Se envían las coordenadas de la mirada (procesadas previamente en el frontend por TensorFlow.js) **cada 5 segundos** para generar mapas de calor y detectar patrones de lectura inusuales.

**Payload:**
```json
{
  "sesion_id": 12345,
  "usuario_id": 67890,
  "timestamp": "2023-10-25T14:30:00.000Z",
  "gaze_points": [
    { "x": 500, "y": 300 },
    { "x": 510, "y": 305 }
  ]
}
```

---

## 3. Audio Chunks (`POST /monitoreo/evidencias/audios`)

Se envían fragmentos de audio en formato WebM **cada ~15 segundos**. El motor de inferencia (por ejemplo, Whisper) procesa estos audios para detectar voces adicionales, ruidos sospechosos o dictado de preguntas.

**Payload (FormData Multipart):**
```typescript
// Campo 'meta' (JSON stringificado)
{
  "sesion_id": 12345,
  "usuario_id": 67890,
  "nombre_usuario": "Juan Perez",
  "examen_id": 999,
  "nombre_examen": "Matemáticas 101",
  "timestamp": 1698244200000,
  "fragmento_indice": 3,
  "browser_focus": true
}

// Campo 'payload_info' (JSON stringificado)
{
  "type": "audio_segment",
  "source": "microphone"
}

// Campo 'file'
Blob (audio/webm)
```

---

## 4. Snapshots Webcam (`POST /monitoreo/evidencias/snapshots`)

Se envían capturas periódicas de la cámara web. El motor de inferencia (por ejemplo, YOLO) analiza estas imágenes para detectar: presencia de múltiples personas, ausencia del alumno, uso de dispositivos móviles (celulares), o suplantación de identidad.

**Payload (FormData Multipart):**
```typescript
// Campo 'meta' (JSON stringificado)
{
  "sesion_id": 12345,
  "usuario_id": 67890,
  "nombre_usuario": "Juan Perez",
  "examen_id": 999,
  "nombre_examen": "Matemáticas 101",
  "timestamp": 1698244200000,
  "browser_focus": true,
  // Opcional: si gaze tracking está activo, se adjunta el historial reciente
  "gaze_history": [
    { "x": 500, "y": 300, "timestamp": 1698244199000 }
  ]
}

// Campo 'payload_info' (JSON stringificado)
{
  "type": "snapshot_webcam",
  "source": "web"
}

// Campo 'file'
Blob (image/jpeg)
```

---

## 5. Validación Biométrica (`POST /usuarios/biometricos/validar`)

Se envía **una vez al inicio** del examen para verificar la identidad del alumno contra su modelo biométrico guardado en el sistema.

**Payload (FormData Multipart):**
```typescript
// Campo 'meta' (JSON stringificado)
{
  "usuario_id": 67890
}

// Campo 'file'
Blob (image/jpeg) // Foto capturada en la fase de preparación
```

---

## 🔄 Flujo de Retorno (Feedback)

El motor de inferencia no solo recibe datos, sino que responde en tiempo real a través de una conexión WebSocket (`ws://.../monitoreo/feedback?session_id=...`). 

A través de esta conexión, el frontend recibe alertas generadas por los modelos de IA del backend (por ejemplo: "Se detectó un celular en la imagen" o "Se escuchan voces adicionales").