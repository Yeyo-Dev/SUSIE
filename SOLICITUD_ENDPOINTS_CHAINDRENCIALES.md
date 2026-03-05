# 📋 Solicitud de Endpoints - Integración SUSIE

> **Para:** Equipo de Backend RH (Chaindrenciales)
> **De:** Equipo SUSIE
> **Fecha:** 4 de Marzo 2026
> **Asunto:** Endpoints requeridos para integrar el sistema de proctoring SUSIE

---

## 🎯 Resumen

Necesitamos que el backend de Chaindrenciales implemente **3 endpoints** para que SUSIE (nuestro sistema de proctoring) pueda funcionar correctamente. A cambio, SUSIE les enviará los resultados del examen y el resumen de proctoring.

---

## 📥 Endpoint 1: Obtener Configuración del Examen

**Propósito:** Cuando un candidato abre un examen, SUSIE necesita saber:
- Las preguntas del examen
- Cuánto tiempo tiene
- Qué nivel de supervisión requiere (cámara, micrófono, biometría)
- Dónde enviar las evidencias

### Request
```
GET /api/evaluaciones/{evaluacionId}/susie-config
Authorization: Bearer {token}
```

### Response (JSON)
```json
{
  "sessionContext": {
    "examSessionId": "sesion_123",
    "examId": "eval_456",
    "examTitle": "Certificación Angular - Turno Mañana",
    "durationMinutes": 60,
    "assignmentId": 789,
    "userId": "usuario_001",
    "userName": "Juan Pérez",
    "userEmail": "juan@email.com"
  },
  "supervision": {
    "requireCamera": true,
    "requireMicrophone": true,
    "requireBiometrics": true,
    "requireGazeTracking": false,
    "maxTabSwitches": 3,
    "inactivityTimeoutMinutes": 5
  },
  "questions": [
    {
      "id": 1,
      "content": "¿Qué es Angular?",
      "options": [
        "Un lenguaje de programación",
        "Un framework SPA",
        "Una base de datos",
        "Un sistema operativo"
      ]
    }
  ],
  "susieApiUrl": "https://susie-api.tuempresa.com/susie/api/v1",
  "authToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### ⚠️ Notas Importantes
- Las preguntas **NO deben incluir la respuesta correcta**
- `susieApiUrl` es la URL de nuestro backend donde se envían las evidencias
- `authToken` es un JWT que SUSIE usará para autenticarse con nuestro backend

---

## 📤 Endpoint 2: Enviar Resultados del Examen

**Propósito:** Cuando el candidato termina el examen (por submit, timeout o cancelación), SUSIE envía las respuestas y el resumen de proctoring.

### Request
```
POST /api/evaluaciones/{evaluacionId}/resultados
Authorization: Bearer {token}
Content-Type: application/json
```

### Body (JSON)
```json
{
  "examSessionId": "sesion_123",
  "status": "submitted",
  "startedAt": "2026-03-04T10:00:00Z",
  "finishedAt": "2026-03-04T10:45:00Z",
  "answers": [
    {
      "questionId": 1,
      "selectedOption": "B",
      "answeredAt": "2026-03-04T10:02:30Z"
    },
    {
      "questionId": 2,
      "selectedOption": "A",
      "answeredAt": "2026-03-04T10:05:15Z"
    }
  ],
  "proctoringSummary": {
    "totalViolations": 2,
    "violationsByType": {
      "TAB_SWITCH": 1,
      "FULLSCREEN_EXIT": 1
    },
    "consentGiven": true,
    "biometricVerified": true,
    "sessionDurationMinutes": 45,
    "susieReportId": "report_susie_abc123"
  }
}
```

### Valores posibles de `status`
| Valor | Descripción |
|-------|-------------|
| `submitted` | El candidato envió el examen manualmente |
| `timeout` | El tiempo se terminó automáticamente |
| `cancelled` | El examen fue cancelado por violaciones |

---

## 📥 Endpoint 3 (Opcional): Inicio de Sesión

**Propósito:** Notificar que el candidato comenzó el examen. Puede ser útil para logs.

### Request
```
POST /api/evaluaciones/{evaluacionId}/sesiones/start
Authorization: Bearer {token}
Content-Type: application/json
```

### Body
```json
{
  "examSessionId": "sesion_123",
  "startedAt": "2026-03-04T10:00:00Z"
}
```

---

## 🔄 Flujo Completo

```
1. Candidato abre examen
   └─→ SUSIE llama a GET /susie-config
       └─← Chaindrenciales devuelve preguntas + config

2. Candidato hace el examen
   └─→ SUSIE envía evidencias a SU backend (no a Chaindrenciales)

3. Candidato termina (submit/timeout/cancel)
   └─→ SUSIE llama a POST /resultados
       └─← Chaindrenciales guarda todo

4. Reclutador revisa el examen
   └─→ Chaindrenciales puede consultar nuestro endpoint de reportes
       └─← SUSIE devuelve detalles de violaciones + snapshots
```
