# 📋 API Spec — Endpoints que Chaindrenciales debe construir para SUSIE

> **Fecha:** 20 de Febrero de 2026  
> **De:** Equipo SUSIE (Frontend)  
> **Para:** Equipo Chaindrenciales (Backend)  
> **Propósito:** Especificación de los endpoints que SUSIE necesita para la integración de exámenes

---

## Resumen

SUSIE necesita **2 endpoints** del backend de Chaindrenciales:

| # | Método | Endpoint | Propósito |
|---|--------|----------|-----------|
| 1 | `GET` | `/api/evaluaciones/:evaluacionId/susie-config` | Obtener config + preguntas del examen |
| 2 | `POST` | `/api/evaluaciones/:evaluacionId/resultados` | Enviar respuestas + reporte de proctoring |

---

## Endpoint 1: Obtener Configuración del Examen

```
GET /api/evaluaciones/:evaluacionId/susie-config
Authorization: Bearer <jwt-candidato>
```

### Response `200 OK`

```json
{
  "sessionContext": {
    "examSessionId": "sess_eval_42_1708456789",
    "examId": "abc-123",
    "examTitle": "Certificación Angular v20",
    "durationMinutes": 30,
    "assignmentId": 42
  },
  "supervision": {
    "requireCamera": true,
    "requireMicrophone": true,
    "requireBiometrics": false,
    "requireGazeTracking": false,
    "maxTabSwitches": 3,
    "inactivityTimeoutMinutes": 5
  },
  "questions": [
    {
      "id": 1,
      "content": "¿Cuál es el principal beneficio de usar Standalone Components?",
      "options": [
        "Reducción de Boilerplate",
        "Mayor velocidad de ejecución",
        "Compatibilidad con AngularJS",
        "Soporte para Web Workers"
      ]
    },
    {
      "id": 2,
      "content": "¿Qué función se usa para inyección de dependencias?",
      "options": [
        "constructor injection",
        "inject()",
        "@Inject() decorator",
        "provide()"
      ]
    }
  ],
  "susieApiUrl": "https://susie-api.example.com/susie/api/v1",
  "authToken": "eyJhbGciOiJSUzI1NiJ9..."
}
```

### De dónde sale cada campo

| Campo en el JSON | Tabla en BD | Columna |
|------------------|------------|---------|
| `sessionContext.examSessionId` | Generado | `"sess_" + evaluacion.id + "_" + timestamp` |
| `sessionContext.examId` | `examenes` | `id` |
| `sessionContext.examTitle` | `examenes` | `titulo` |
| `sessionContext.durationMinutes` | `examenes` | `duracion_minutos` ⚠️ **NUEVO** |
| `sessionContext.assignmentId` | `evaluaciones` | `id` |
| `supervision.requireCamera` | `configuracion_examen` | `camara` |
| `supervision.requireMicrophone` | `configuracion_examen` | `microfono` |
| `supervision.requireBiometrics` | `configuracion_examen` | `validacion_biometrica` |
| `supervision.requireGazeTracking` | `configuracion_examen` | `analisis_mirada` |
| `supervision.maxTabSwitches` | `configuracion_examen` | `MaxCambioPesta` |
| `supervision.inactivityTimeoutMinutes` | `configuracion_examen` | `tiempo_sin_inactividad` |
| `questions[].id` | `preguntas` | `pregunta_id` |
| `questions[].content` | `preguntas` | `contenido` |
| `questions[].options` | `preguntas` | `[opcion1, opcion2, opcion3, opcion4]` |
| `susieApiUrl` | Config/Env | URL del backend de SUSIE |
| `authToken` | Generado | JWT del candidato |

> ⚠️ **IMPORTANTE:** `preguntas.respuesta` **NUNCA** debe incluirse en el response. SUSIE no evalúa, solo recolecta.

### Errores

| Status | Cuándo |
|--------|--------|
| `401 Unauthorized` | JWT inválido o expirado |
| `403 Forbidden` | Candidato no asignado a esta evaluación |
| `404 Not Found` | Evaluación no existe |
| `410 Gone` | Evaluación ya completada o expirada |

---

## Endpoint 2: Recibir Resultados del Examen

```
POST /api/evaluaciones/:evaluacionId/resultados
Authorization: Bearer <jwt-candidato>
Content-Type: application/json
```

### Request Body

```json
{
  "answers": {
    "1": "Reducción de Boilerplate",
    "2": "inject()",
    "3": "ChangeDetectionStrategy.OnPush"
  },
  "completedAt": "2026-02-20T23:45:00.000Z",
  "status": "submitted",
  "proctoring": {
    "susieReportId": "rpt_abc123",
    "consentGiven": true,
    "totalViolations": 2,
    "totalSnapshots": 45,
    "totalAudioChunks": 120
  }
}
```

### Campos del Request

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `answers` | `{ questionId: respuesta }` | Respuesta seleccionada por pregunta |
| `completedAt` | `ISO 8601 string` | Timestamp de finalización |
| `status` | `"submitted" \| "cancelled" \| "expired"` | Cómo terminó el examen |
| `proctoring.susieReportId` | `string` | ID para consultar detalle en API de SUSIE |
| `proctoring.consentGiven` | `boolean` | ¿Candidato aceptó T&C? |
| `proctoring.totalViolations` | `number` | Cantidad de violaciones detectadas |
| `proctoring.totalSnapshots` | `number` | Fotos capturadas durante el examen |
| `proctoring.totalAudioChunks` | `number` | Chunks de audio capturados |

### Response `201 Created`

```json
{
  "evaluacionId": 42,
  "status": "completed",
  "receivedAt": "2026-02-20T23:45:01.000Z"
}
```

### Qué hace Chaindrenciales al recibir esto

1. Guarda cada `answer` en `respuestas_usuario` (`pregunta_id`, `respuesta_texto`, `usuario_id`)
2. Compara contra `preguntas.respuesta` para calificar
3. Guarda `susie_status` y `susie_report_id` en `evaluaciones` (⚠️ **columnas nuevas**)

### Errores

| Status | Cuándo |
|--------|--------|
| `401 Unauthorized` | JWT inválido |
| `404 Not Found` | Evaluación no existe |
| `409 Conflict` | Resultados ya fueron enviados anteriormente |

---

## Cambios necesarios en la BD de Chaindrenciales

| Tabla | Cambio | Detalle |
|-------|--------|---------|
| `examenes` | **Agregar columna** | `duracion_minutos INTEGER NOT NULL` |
| `evaluaciones` | **Agregar columna** | `susie_status ENUM('clean','flagged','cancelled') DEFAULT NULL` |
| `evaluaciones` | **Agregar columna** | `susie_report_id VARCHAR(100) DEFAULT NULL` |

---

## Notas para el equipo

- El `authToken` que nos pasan será el JWT que SUSIE usa para autenticarse con **nuestro** backend (no con el de ustedes). Pueden generar uno específico para la sesión.
- El `susieApiUrl` apunta a nuestro backend de SUSIE, no al de ustedes. En desarrollo local será `http://localhost:8000/susie/api/v1`.
- SUSIE ya tiene todo implementado del lado frontend con datos mock. En cuanto estos endpoints estén listos, solo cambiamos el URL y funciona.
