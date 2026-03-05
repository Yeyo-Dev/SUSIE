# 📋 Solicitud de Endpoints Faltantes — Frontend → Backend

**Fecha:** 2026-03-05  
**De:** Equipo Frontend (SUSIE)  
**Para:** Equipo Backend (SUSIE)  
**Contexto:** Se completó la integración del frontend con los 11 endpoints documentados en `api_docs.md`. Durante la integración se identificaron los siguientes puntos **bloqueantes** que aún no están cubiertos.

---

## 🔴 1. Endpoint para enviar respuestas del examen (CRÍTICO)

**Problema:** El frontend genera un `ExamResult` con todas las respuestas del alumno al finalizar el examen, pero **no existe un endpoint documentado donde enviarlas**.

**Endpoint sugerido:**

```
POST /examenes/:examen_id/respuestas
```

**Body esperado:**
```json
{
  "id_sesion": 25,
  "id_asignacion": 10,
  "usuario_id": 5,
  "respuestas": [
    { "pregunta_id": 1, "respuesta_seleccionada": "4" },
    { "pregunta_id": 2, "respuesta_seleccionada": "signal()" }
  ],
  "fecha_entrega": "2026-03-05T19:00:00.000Z"
}
```

**Respuesta esperada (`201`):**
```json
{
  "status": "success",
  "message": "Respuestas registradas correctamente",
  "data": {
    "id_resultado": "42",
    "calificacion": 85,
    "total_correctas": 17,
    "total_preguntas": 20
  }
}
```

> Sin este endpoint, **el examen no tiene cierre funcional**. Las respuestas se pierden al cerrar la sesión.

---

## 🔴 2. Autenticación del estudiante (CRÍTICO)

**Problema:** Todos los endpoints de monitoreo requieren un header `Authorization: Bearer <token>`, pero **no hay un endpoint de autenticación documentado** ni forma de obtener el JWT del estudiante.

**Opciones:**

| Opción | Descripción |
|--------|-------------|
| **A) El backend provee login** | `POST /auth/login` → devuelve JWT |
| **B) Chaindrenciales provee el token** | La app host pasa el JWT al frontend como parte de la config |
| **C) Token firmado en la evaluación** | `GET /evaluaciones/configuracion/:id` incluye un campo `auth_token` en su respuesta |

**Recomendación:** Opción **C** es la más simple — el backend genera un token temporal al momento de cargar la configuración y lo incluye en la respuesta. El frontend lo usa en todas las llamadas posteriores.

**Campo adicional sugerido en la respuesta de `/evaluaciones/configuracion/:id`:**
```json
{
  "success": true,
  "evaluacion": { ... },
  "auth_token": "eyJhbGciOiJIUzI1NiIs..."
}
```

---

## 🟡 3. Heartbeat / Tolerancia de desconexión

**Problema:** La configuración devuelve `tolerancia_desconexion: 30` (segundos), pero **no existe un mecanismo para que el frontend reporte que sigue conectado**, ni documentación de qué pasa cuando se excede esa tolerancia.

**Endpoint sugerido:**

```
POST /sesiones/:id_sesion/heartbeat
```

**Body:**
```json
{
  "timestamp": 1741200000000
}
```

**Respuesta (`200`):**
```json
{
  "status": "ok",
  "sesion_activa": true
}
```

> Sin esto, el backend no tiene forma de saber si el alumno se desconectó y la `tolerancia_desconexion` no tiene efecto real.

---

## 🟡 4. Tipos de infracción adicionales

**Situación:** El enum actual de infracciones es: `CAMBIO_DE_PESTAÑA | USO_DE_TELEFONO | OTRO`.

El frontend detecta infracciones más específicas que actualmente todas caen en `OTRO`:
- `FULLSCREEN_EXIT` — Salió de pantalla completa
- `DEVTOOLS_OPENED` — Intentó abrir herramientas de desarrollador
- `CLIPBOARD_ATTEMPT` — Intentó copiar/pegar
- `GAZE_DEVIATION` — Desvió la mirada
- `NAVIGATION_ATTEMPT` — Intentó navegar fuera
- `RELOAD_ATTEMPT` — Intentó recargar la página

**Sugerencia:** Ampliar el enum de `tipo_infraccion` para incluir al menos:
```
CAMBIO_DE_PESTAÑA | USO_DE_TELEFONO | SALIDA_PANTALLA_COMPLETA | 
HERRAMIENTAS_DESARROLLADOR | DESVIACION_MIRADA | OTRO
```

---

## Resumen

| # | Solicitud | Prioridad | Bloqueante |
|---|-----------|-----------|------------|
| 1 | Endpoint envío de respuestas | 🔴 Crítica | ✅ Sí |
| 2 | Autenticación / JWT | 🔴 Crítica | ✅ Sí |
| 3 | Heartbeat de sesión | 🟡 Alta | ❌ No (pero la tolerancia queda sin efecto) |
| 4 | Tipos de infracción ampliados | 🟡 Media | ❌ No (se usa `OTRO` como fallback) |

---

*¿Dudas? Contactar al equipo frontend para aclarar payloads o flujos.*
