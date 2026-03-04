# 📋 Tareas Pendientes — Frontend SUSIE

> Generado: 19 Feb 2026
> Fuente: Análisis de `architecture.md` vs implementación actual

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

- [x] **6. Biometría → API enrollment y verificación UI** (~3h) ✅ _Completada_
  - Enviar foto capturada al Gateway (`POST /biometrics/enroll`)
  - Hoy la foto se captura pero no se usa

---

## 🟠 Prioridad Baja (diferenciadores)

- [x] **7. Canal WebSocket de feedback** (~4h) ✅ _Completada_
  - El frontend debe recibir alertas en tiempo real del Motor de Inferencia
  - Crear `AlertService` que escuche: `RISK_ALERT`, `IDENTITY_MISMATCH`, `SESSION_TERMINATED`
  - Mostrar overlay al candidato cuando riesgo es alto

- [ ] **8. Cola de reintentos para evidencias** (~4h)
  - Si la red falla, las evidencias se pierden
  - Implementar respaldo en `IndexedDB`/`localStorage`
  - Reintentar al reconectar (usar `NetworkMonitorService`)

---

**Tiempo total estimado: ~19h**

## Documentos relacionados
- [Arquitectura del Sistema](./architecture.md)
- [Arquitectura Motor de Exámenes](./ARQUITECTURA_SUSIE_MOTOR_EXAMENES.md)
- [Infraestructura y Deploy](./INFRAESTRUCTURA_DEPLOY_SUSIE.md)
