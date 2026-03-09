# Roadmap de Implementación — Tareas Frontend y Backend

> **Fecha:** 2 de Marzo 2026  
> **Fuente:** Análisis competitivo vs implementación actual

---

## Resumen de Estado

| Capa | Madurez | Falta |
|------|---------|-------|
| **Frontend (Angular)** | 🟢 ~95% | Tests de componentes, a11y, i18n, recovery de sesión |
| **Backend (Fastify)** | 🟢 ~92% | Refinar tests e integrar reportes |
| **AI Models (Python)** | 🟢 ~85% | Solo falta integrar Red Bayesiana Master |

---

## 🚀 TAREAS FRONTEND

### Prioridad ALTA

#### [F-01] Biometría End-to-End — Integración con API
**Descripción:** Conectar la captura de foto del onboarding con los endpoints de biometría del backend  
**Estado:** ✅ Completado  
**Dependencias:** [B-01] Endpoints de biometría en backend  
**Entregables:**
- Llamar `POST /biometrics/enroll` después de capturar foto de onboarding
- Llamar `POST /biometrics/verify` periódicamente durante el examen (cada N snapshots)
- Guardar embedding_id retornado por el backend
- Manejar errores de verificación (no match)

**Archivo probable:** `projects/ngx-susie-proctoring/src/lib/services/evidence.service.ts`

---

#### [F-02] Métricas de Proctoring en ExamResult
**Descripción:** Agregar datos de proctoring al resultado que se envía a Chaindrenciales  
**Estado:** ✅ Completado  
**Entregables:**
- Extender interfaz `ExamResult` para incluir:
  ```typescript
  proctoring: {
    totalViolations: number;
    violationsByType: Record<string, number>;
    snapshotsCaptured: number;
    audioChunksUploaded: number;
    biometricVerified: boolean;
    sessionDuration: number;
    susieReportId?: string;
  }
  ```
- Recopilar这些 métricas durante la sesión
- Enviar en el POST de resultados

**Archivo probable:** `projects/ngx-susie-proctoring/src/lib/models/contracts.ts`

---

### Prioridad MEDIA

#### [F-03] Cola de Reintentos + IndexedDB (Offline Resilience)
**Descripción:** Implementar persistencia local cuando falla el envío de evidencias  
**Estado:** ✅ Completado (9-Mar-2026)  
**RNF-008, RNF-009 del PRD  
**Implementado:**
- `EvidenceQueueService` creado con IndexedDB (librería `idb`)
- `EvidenceService` modificado para fallback automático al fallar uploads
- Retry con backoff exponencial al reconectar (usa `NetworkMonitorService`)
- Tests unitarios incluidos (EvidenceQueueService + EvidenceService)

**Archivos:**
- `projects/ngx-susie-proctoring/src/lib/services/evidence-queue.service.ts`
- `projects/ngx-susie-proctoring/src/lib/services/evidence.service.ts`

---

#### [F-04] WebSocket —接收 Eventos del Backend
**Descripción:** Escuchar eventos en tiempo real del backend  
**Estado:** ✅ Completado  
**Entregables:**
- Crear `WebSocketService` para conexión persistente
- Implementar manejo de eventos:
  - `RISK_ALERT` — Mostrar advertencia visual al candidato
  - `IDENTITY_MISMATCH` — Alertar si la cara no coincide
  - `SESSION_TERMINATED` — Cancelar examen remotamente
- Reconexión automática con backoff
- Graceful degradation si WebSocket no está disponible

**Archivos probables:**
- `projects/ngx-susie-proctoring/src/lib/services/websocket.service.ts` (nuevo)
- `projects/ngx-susie-proctoring/src/lib/components/susie-wrapper.component.ts` (modificar)

---

#### [F-05] Alinear Contrato SusieExamConfig al Spec
**Descripción:** Verificar y corregir el contrato de configuración  
**Estado:** ✅ Completado  
**Entregables:**
- Revisar `SusieExamConfig` vs spec del PRD
- Agregar campos faltantes:
  - `sessionContext.assignmentId`
  - `securityPolicies.requireGazeTracking`
  - `audioConfig.chunkIntervalSeconds`
  - `capture.snapshotIntervalSeconds`
- Mapear correctamente desde `ChaindrencialesExamConfig`

**Archivo probable:** `projects/ngx-susie-proctoring/src/lib/models/contracts.ts`

---

### Prioridad BAJA

#### [F-06] Integrar Gaze Tracking con Análisis de Backend
**Descripción:** Enviar datos de gaze al backend para procesamiento  
**Estado:** ✅ Completado (6-Mar-2026)  
**Implementado:**
- Envío continuo de coordenadas de gaze al backend a intervalos regulares
- `GazeTrackingService` con calibración MediaPipe, tracking y envío de datos
- Endpoint receptor implementado en backend

---

#### [F-07] UI de Advertencias en Tiempo Real
**Descripción:** Mostrar warnings visuales cuando el backend envía alertas  
**Estado:** ✅ Completado  
**Dependencias:** [F-04] WebSocket  
**Entregables:**
- Toast/notification para warnings menores
- Modal blocking para advertencias críticas
- Banner de "monitoreo activo"

---

#### [F-08] Tests Unitarios de Servicios
**Descripción:** Aumentar coverage de tests para servicios  
**Estado:** ✅ Completado (9-Mar-2026)  
**Implementado:**
- `SecurityService` — 14 tests (listeners, infracciones, teardown)
- `WebSocketFeedbackService` — 13 tests (conexión, mensajes, reconexión)
- `EvidenceService` — tests de fallback offline
- `EvidenceQueueService` — tests de cola IndexedDB
- Total: 68/68 tests pasando

---

## 🆕 NUEVAS TAREAS FRONTEND

### Prioridad ALTA

#### [F-09] Tests Unitarios de Componentes
**Descripción:** Cubrir componentes Angular principales con tests  
**Estado:** ❌ Pendiente  
**Entregables:**
- Tests para `SusieWrapperComponent` (orquestador principal)
- Tests para `ExamEngineComponent` (motor de preguntas)
- Tests para `BiometricOnboardingComponent`
- Tests para `ConsentDialogComponent`

---

#### [F-10] Tests para GazeTrackingService e InactivityService
**Descripción:** Servicios sin archivos `.spec.ts`  
**Estado:** ❌ Pendiente  
**Entregables:**
- `gaze-tracking.service.spec.ts` — Tests de calibración, tracking, envío de datos
- `inactivity.service.spec.ts` — Tests de detección de inactividad

---

### Prioridad MEDIA

#### [F-11] Indicador Visual de Evidencias Offline Pendientes
**Descripción:** Badge/icono visible al candidato mostrando evidencias pendientes de envío  
**Estado:** ❌ Pendiente  
**Dependencias:** [F-03] Cola de Reintentos  
**Entregables:**
- Componente visual (badge) que muestre count de evidencias en cola
- Integrar con `EvidenceQueueService.getPendingCount()`

---

#### [F-12] Environment Check Avanzado
**Descripción:** Mejorar verificación previa al examen  
**Estado:** ❌ Pendiente  
**Entregables:**
- Verificación de iluminación (análisis de brillo del canvas)
- Verificación de presencia de cara antes de empezar
- Audio level check (micrófono captando correctamente)

---

#### [F-13] Accesibilidad (a11y)
**Descripción:** Revisión completa de accesibilidad  
**Estado:** ❌ Pendiente  
**Entregables:**
- Roles ARIA en todos los componentes
- Navegación por teclado
- Contraste de colores

---

#### [F-14] Internacionalización (i18n)
**Descripción:** Soporte multi-idioma  
**Estado:** ❌ Pendiente  
**Entregables:**
- Extraer textos hardcoded a archivos de traducción
- Soporte es/en como mínimo

---

### Prioridad BAJA

#### [F-15] Recovery de Sesión (RNF-009)
**Descripción:** Recuperar progreso si se pierde conexión o cierra pestaña  
**Estado:** ❌ Pendiente  
**Entregables:**
- Persistir estado de respuestas en `localStorage`/`IndexedDB`
- Recuperar progreso automáticamente al reconectar

---

#### [F-16] Dashboard de Estado para el Candidato
**Descripción:** Mini-panel lateral con información de estado en tiempo real  
**Estado:** ❌ Pendiente  
**Entregables:**
- Estado de cámara/mic (activos ✅)
- Violaciones acumuladas
- Conexión al WebSocket
- Estado de red

---

#### [F-17] Optimización Adaptativa de Snapshots
**Descripción:** Reducir calidad/peso adaptivamente según velocidad de red  
**Estado:** ❌ Pendiente  
**Entregables:**
- Medir velocidad de upload
- Ajustar calidad JPEG dinámicamente

---

#### [F-18] Performance Monitoring
**Descripción:** Métricas de rendimiento del cliente  
**Estado:** ❌ Pendiente  
**Entregables:**
- Uso de memoria del navegador
- Frames dropped en captura
- Latencia de uploads

---

## ⚙️ TAREAS BACKEND

### Prioridad ALTA

#### [B-01] Endpoints de Biometría
**Descripción:** Implementar enrollment y verificación de identidad  
**Estado:** ❌ Pendiente  
**Entregables:**

| Endpoint | Método | Función |
|----------|--------|---------|
| `/biometrics/enroll` | POST multipart | Recibe foto, genera embedding con DeepFace, guarda referencia, retorna embedding_id |
| `/biometrics/verify` | POST multipart | Recibe foto, compara con embedding de referencia, retorna match_score |

**Archivo probable:** `backend/src/routes/biometrics.routes.ts` (nuevo)

**Notas técnicas:**
- Usar DeepFace para generar embeddings (128 vectores)
- No guardar imágenes, solo embeddings
- Guardar en PostgreSQL o Redis con correlation_id

---

#### [B-02] Worker YOLO — Detección de Objetos
**Descripción:** Detectar celulares, libros, personas extra en snapshots  
**Estado:** ❌ Pendiente  
**Dependencias:** [B-06] RabbitMQ  
**Entregables:**
- Crear worker que consuma cola `susie.ai.vision`
- Usar modelo YOLO para detección de objetos
- Retornar: objetos detectados, bounding boxes, confianza
- Guardar resultados en PostgreSQL

**Archivo probable:** `ai_models/workers/yolo_worker.py` (nuevo)

---

#### [B-03] Worker DeepFace — Verificación Facial
**Descripción:** Verificar que el candidato es quien dice ser  
**Estado:** ❌ Pendiente  
**Dependencias:** [B-01] Endpoints de biometría  
**Entregables:**
- Integrar DeepFace para comparación de embeddings
- Consumir snapshots de la cola
- Comparar con embedding de enrollment
- Retornar: face_match_score, faces_detected

**Archivo probable:** `ai_models/workers/deepface_worker.py` (nuevo)

---

### Prioridad MEDIA

#### [B-04] Endpoints de Reportes (Dashboard)
**Descripción:** API para que Chaindrenciales consulte el reporte de proctoring  
**Estado:** ❌ Pendiente  
**Entregables:**

| Endpoint | Método | Función |
|----------|--------|---------|
| `/reportes/:id` | GET | Reporte general: status, riskScore, summary |
| `/reportes/:id/violations` | GET | Timeline de violaciones con metadatos |
| `/reportes/:id/snapshots` | GET | Lista snapshots con análisis IA |
| `/reportes/:id/audio` | GET | Lista audio chunks con transcripción |

**Archivo probable:** `backend/src/routes/reportes.routes.ts` (nuevo)

---

#### [B-05] WebSocket Server
**Descripción:** Servidor WebSocket para feedback en tiempo real  
**Estado:** ✅ Completado  
**Entregables:**
- Implementar WebSocket en Fastify (`@fastify/websocket`)
- Eventos a emitir:
  - `RISK_ALERT` — Cuando el riesgo supera threshold
  - `IDENTITY_MISMATCH` — Cuando verificación facial falla
  - `SESSION_TERMINATED` — Cuando se cancela remotamente
- Connection management por session_id

**Archivo probable:** `backend/src/websocket/susie.ws.ts` (nuevo)

---

#### [B-06] RabbitMQ — Configuración de Colas
**Descripción:** Configurar exchange y colas para procesamiento de evidencias  
**Estado:** ✅ Completado  
**Entregables:**
- Exchange: `susie.events`
- Colas:
  - `susie.ai.vision` — Snapshots para YOLO/DeepFace
  - `susie.ai.audio` — Audio chunks para Whisper
  - `susie.inference` — Datos para motor de riesgo
- Configurar dead-letter queue para errores

---

#### [B-07] Motor de Riesgo Probabilístico
**Descripción:** Calcular score de riesgo correlacionando todas las señales  
**Estado:** ❌ Pendiente  
**Entregables:**
- Worker que consuma cola `susie.inference`
- Algoritmo de scoring basado en:
  - # de tab switches
  - # de violaciones
  - Audio transcrito (palabras sospechosas)
  - Gaze deviation
  - Face match score
  - Objetos detectados
- Output: `riskScore: 0-100`
- Guardar en PostgreSQL asociado al reporte

**Archivo probable:** `ai_models/workers/risk_engine.py` (nuevo)

---

### Prioridad BAJA

#### [B-08] Worker Whisper — Transcripción de Audio
**Descripción:** Transcribir audio para detectar respuestas dictadas  
**Estado:** ❌ Pendiente  
**Entregables:**
- Worker que consuma cola `susie.ai.audio`
- Usar Whisper para transcripción
- Detectar palabras clave sospechosas
- Retornar: transcripción, voces_detectadas

**Archivo probable:** `ai_models/workers/whisper_worker.py` (nuevo)

---

#### [B-09] Worker MediaPipe — Análisis de Mirada (Backend)
**Descripción:** Procesar snapshots para análisis de gaze en backend  
**Estado:** ❌ Pendiente  
**Entregables:**
- Consumir cola de snapshots
- Usar MediaPipe para análisis facial
- Calcular dirección de mirada
- Guardar en PostgreSQL

---

#### [B-10] Azure Blob Storage — Integración
**Descripción:** Configurar almacenamiento de evidencias en Azure  
**Estado:** ✅ Completado  
**Entregables:**
- Subir snapshots (JPEG) a Azure Blob
- Subir audio chunks (WebM) a Azure Blob
- Generar URLs SAS temporales
- Guardar URLs en PostgreSQL

---

## 📦 Dependencias entre Tareas

```
FRONTEND                           BACKEND
─────────────────────────────────────────────────────────
[F-01] Biometría E2E  ─────────►  [B-01] Endpoints biometría
                                     │
                                     ▼
[F-02] Métricas ExamResult      [B-02] Worker YOLO
                                     │
                                     ▼
[F-03] Retry + IndexedDB ◄────  [B-06] RabbitMQ config
                                     │
                                     ▼
[F-04] WebSocket handling ◄────  [B-05] WebSocket server
                                     │
                                     ▼
[F-05] Alinear contrato        [B-04] Endpoints reportes
                                     │
                                     ▼
                                  [B-07] Motor de riesgo
```

---

## 🎯 Orden de Implementación Recomendado

### ✅ Sprint 1-2 (Quick Wins) — COMPLETADOS
1. ~~[B-01] Endpoints de biometría (Backend)~~
2. ~~[F-01] Biometría E2E (Frontend)~~

### ✅ Sprint 3-5 (Core IA) — COMPLETADOS
3. ~~[B-06] RabbitMQ config~~
4. ~~[B-02] Worker YOLO~~
5. ~~[B-03] Worker DeepFace~~

### ✅ Sprint 6-8 (Diferenciadores) — COMPLETADOS
6. ~~[F-03] Retry + IndexedDB (Frontend)~~
7. ~~[B-05] WebSocket server~~
8. ~~[F-04] WebSocket handling (Frontend)~~
9. [B-04] Endpoints reportes ❌
10. ~~[F-02] Métricas en ExamResult~~

### Sprint 9+ (Pendientes)
11. [B-07] Motor de riesgo ❌
12. ~~[B-08] Worker Whisper~~
13. ~~[B-09] Worker MediaPipe (backend)~~

### Sprint 10+ (Nuevas Tareas Frontend)
14. [F-09] Tests de componentes
15. [F-10] Tests GazeTracking/Inactivity
16. [F-11] Indicador offline
17. [F-12] Environment check avanzado
18. [F-13] Accesibilidad
19. [F-14] Internacionalización
20. [F-15] Recovery de sesión
21. [F-16] Dashboard de estado
22. [F-17] Optimización snapshots
23. [F-18] Performance monitoring
