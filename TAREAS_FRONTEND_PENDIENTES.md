# 📋 Tareas Pendientes — Frontend SUSIE

> Actualizado: 9 Marzo 2026
> Fuente: Análisis de `architecture.md` vs implementación actual + sesiones SDD

---

## 🔴 Prioridad Alta (el sistema no cumple su propósito sin estos)

- [x] **1. Violaciones → Backend** (~1h) ✅ _Completada 23-Feb-2026_
  - `SecurityService` → `susie-wrapper.handleViolation()` → `EvidenceService.sendEvent({ type: 'BROWSER_EVENT' })` → `POST /monitoreo/evidencias/eventos`
  - El flujo ya estaba implementado y fue verificado contra `PAYLOAD_EVENTOS_SUSIE.md`

- [x] **2. Activar snapshots periódicos de video** (~1h) ✅ _Completada 23-Feb-2026_
  - Agregado `capture: { snapshotIntervalSeconds: 30 }` en `mapToSusieConfig` de `contracts.ts`
  - El `susie-wrapper` activa `startSnapshotLoop()` solo cuando `requireCamera === true`

- [x] **3. Eventos de sesión (start/end)** (~2h) ✅ _Frontend Completado 23-Feb-2026_
  - `POST /monitoreo/sesiones/start` al iniciar examen (examSessionId, examId, userId, timestamp)
  - `POST /monitoreo/sesiones/end` al terminar o abortar (añadido keepalive=true)
  - *Nota: Queda pendiente la implementación del módulo sesiones/ en el backend (registrado en Engram).*
  
---

## 🟡 Prioridad Media

- [x] **4. Alinear contrato con spec `SusieExamConfig`** (~2h) ✅ _Completada_
  - Agregar `session.assignmentId`
  - Agregar `timer.autoSubmitOnExpiry`
  - Agregar `consent.termsText` y `consent.privacyNotice`
  - Hacer `correctAnswer` opcional/quitar de prod

- [x] **5. Métricas de proctoring en `ExamResult`** (~2h) ✅ _Completada_
  - Al finalizar, incluir en el resultado: `violations[]`, `capturedSnapshots`, `capturedAudioChunks`, `consentGiven`, `biometricVerified`

- [x] **6. Biometría → API enrollment y verificación UI** (~3h) ✅ _Completada 6-Mar-2026_
  - Flujo completo de enrollment con UI dedicada, validación de cara detectada
  - Integración con endpoints `POST /biometrics/enroll` y `POST /biometrics/verify`

---

## 🟠 Prioridad Baja (diferenciadores)

- [x] **7. Canal WebSocket de feedback** (~4h) ✅ _Completada_
  - `WebSocketFeedbackService` recibe alertas en tiempo real del Motor de Inferencia
  - Maneja: `RISK_ALERT`, `IDENTITY_MISMATCH`, `SESSION_TERMINATED`
  - Reconexión automática con backoff exponencial

- [x] **8. Cola de reintentos para evidencias** (~4h) ✅ _Completada 9-Mar-2026_
  - `EvidenceQueueService` implementado con IndexedDB (librería `idb`)
  - Respaldo automático de evidencias fallidas (audio, snapshots, gaze data)
  - Reintento con backoff exponencial al reconectar (usa `NetworkMonitorService`)
  - Tests unitarios incluidos

- [x] **9. Tests unitarios de servicios** (~3h) ✅ _Completada 9-Mar-2026_
  - `SecurityService` — 14 tests cubriendo listeners, infracciones, teardown
  - `WebSocketFeedbackService` — 13 tests cubriendo conexión, mensajes, reconexión
  - `EvidenceService` — tests de fallback offline
  - `EvidenceQueueService` — tests de cola IndexedDB
  - Total: 68/68 tests pasando

---

## 🆕 Nuevas Tareas Identificadas

### 🔴 Prioridad Alta

- [x] **10. Tests unitarios de Componentes** (~6h) ✅ _Completada 10-Mar-2026_
  - Tests para `SusieWrapperComponent` (orquestador principal)
  - Tests para `ExamEngineComponent` (motor de preguntas)
  - Tests para `BiometricOnboardingComponent`
  - Tests para `ConsentDialogComponent`

- [x] **11. Tests para GazeTrackingService e InactivityService** (~3h) ✅ _Completada 10-Mar-2026_
  - Ambos servicios carecen de `.spec.ts`
  - GazeTrackingService es complejo (MediaPipe, calibración, envío de datos)

### 🟡 Prioridad Media

- [ ] **12. Indicador visual de evidencias offline pendientes** (~2h)
  - Badge/icono visible al candidato mostrando "X evidencias pendientes de envío"
  - Integrar con `EvidenceQueueService.getPendingCount()`

- [ ] **13. Environment Check avanzado** (~4h)
  - Verificación de iluminación (análisis de brillo del canvas)
  - Verificación de presencia de cara antes de empezar
  - Audio level check (micrófono captando correctamente)

- [ ] **14. Accesibilidad (a11y)** (~4h)
  - Revisión de roles ARIA en todos los componentes
  - Navegación por teclado
  - Contraste de colores

- [ ] **15. Internacionalización (i18n)** (~6h)
  - Textos actualmente hardcoded
  - Soporte multi-idioma (es/en mínimo)

### 🟠 Prioridad Baja

- [ ] **16. Recovery de sesión (RNF-009)** (~4h)
  - Persistir estado de respuestas en `localStorage`/`IndexedDB`
  - Recuperar progreso si se pierde conexión o cierra pestaña accidentalmente

- [ ] **17. Dashboard de estado para el candidato** (~3h)
  - Mini-panel mostrando: estado cámara/mic, violaciones acumuladas, conexión WS, estado de red

- [ ] **18. Optimización adaptativa de Snapshots** (~2h)
  - Reducir calidad/peso adaptivamente según velocidad de red

- [ ] **19. Performance monitoring** (~3h)
  - Métricas de uso de memoria, frames dropped, latencia de uploads

---

**Tiempo total nuevas tareas estimado: ~37h**

## Documentos relacionados
- [Arquitectura del Sistema](./ARCHITECTURE_SUSIE.md)
- [PRD SUSIE](./PRD_SUSIE.md)
- [Roadmap de Tareas](./ROADMAP_TAREAS.md)
