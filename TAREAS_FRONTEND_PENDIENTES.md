# 📋 Tareas Pendientes — Frontend SUSIE

> Generado: 19 Feb 2026
> Fuente: Análisis de `architecture.md` vs implementación actual

---

## 🔴 Prioridad Alta (el sistema no cumple su propósito sin estos)

- [ ] **1. Violaciones → Backend** (~1h)
  - Conectar `SecurityService` con `EvidenceService` para enviar cada violación como `BROWSER_EVENT` al Gateway
  - Actualmente solo ejecuta callback local, las violaciones no se persisten

- [ ] **2. Activar snapshots periódicos de video** (~1h)
  - `captureSnapshot()` existe pero nunca se activa (falta default en `snapshotIntervalSeconds`)
  - Poner default razonable (ej: 30s) y validar envío al endpoint `/evidence`

- [ ] **3. Eventos de sesión (start/end)** (~2h)
  - `POST /sessions/start` al iniciar examen (examSessionId, examId, userId, timestamp)
  - `POST /sessions/end` al finalizar (status: submitted/cancelled, timestamp)
  - El Gateway necesita esto para crear registros en PostgreSQL

---

## 🟡 Prioridad Media

- [ ] **4. Alinear contrato con spec `SusieExamConfig`** (~2h)
  - Agregar `session.assignmentId`
  - Agregar `timer.autoSubmitOnExpiry`
  - Agregar `consent.termsText` y `consent.privacyNotice`
  - Hacer `correctAnswer` opcional/quitar de prod

- [ ] **5. Métricas de proctoring en `ExamResult`** (~2h)
  - Al finalizar, incluir en el resultado: `violations[]`, `capturedSnapshots`, `capturedAudioChunks`, `consentGiven`, `biometricVerified`

- [ ] **6. Biometría → API enrollment** (~3h)
  - Enviar foto capturada al Gateway (`POST /biometrics/enroll`)
  - Hoy la foto se captura pero no se usa

---

## 🟠 Prioridad Baja (diferenciadores)

- [ ] **7. Canal WebSocket de feedback** (~4h)
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
