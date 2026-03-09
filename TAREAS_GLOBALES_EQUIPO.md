# 📋 Tareas Pendientes Globales (SUSIE)
> **Fecha de Actualización:** 9 Marzo 2026
> **Estado General:** Frontend (~95%), AI Models (~85%), Backend (~92%)

Este documento consolida todas las tareas faltantes para completar el sistema SUSIE, divididas por equipo responsable. Es el documento fuente para la asignación de próximos sprints.

---

## 💻 Equipo Frontend (Vielma)
**Estado:** Fase Final (Servicios core completos, faltan tests de componentes y mejoras de calidad)
El core de supervisión, grabación, reglas, UI y resiliencia offline está completo.

- [x] **Resiliencia Offline (IndexedDB):** ✅ _Completada 9-Mar-2026_ — `EvidenceQueueService` con `idb`, retry automático con backoff exponencial.
- [x] **Integración Gaze Tracking:** ✅ _Completada 6-Mar-2026_ — Envío continuo de coordenadas al backend, calibración MediaPipe integrada.
- [x] **UI de Alertas (WebSocket):** ✅ — `WebSocketFeedbackService` escucha alertas y muestra overlays al candidato.
- [x] **Validación Biométrica Inicial:** ✅ _Completada 6-Mar-2026_ — Flujo de enrollment con UI dedicada, llamadas API integradas.
- [x] **Tests Unitarios de Servicios:** ✅ _Completada 9-Mar-2026_ — SecurityService, WebSocketFeedbackService, EvidenceService, EvidenceQueueService (68/68 tests).
- [ ] **Tests Unitarios de Componentes:** `SusieWrapperComponent`, `ExamEngineComponent`, `BiometricOnboardingComponent`, `ConsentDialogComponent`.
- [ ] **Tests para GazeTrackingService e InactivityService:** Servicios sin `.spec.ts`.
- [ ] **Indicador Visual Offline:** Badge visible al candidato con evidencias pendientes.
- [ ] **Environment Check Avanzado:** Iluminación, presencia de cara, audio level check.
- [ ] **Accesibilidad (a11y):** Roles ARIA, navegación por teclado, contraste.
- [ ] **Internacionalización (i18n):** Soporte es/en mínimo.
- [ ] **Recovery de Sesión (RNF-009):** Persistir respuestas en localStorage/IndexedDB.
- [ ] **Dashboard de Estado:** Mini-panel con estado de cámara, mic, red, WS.

---

## ⚙️ Equipo Backend (Fastify/Node.js)
**Estado:** Fase Final (Endpoints construidos, faltan reportes y motor de riesgo)
El backend ha completado la refactorización mayor (Multipart, WebSockets, RabbitMQ). Falta conectar con Chaindrenciales.

- [x] **Endpoints de Recepción Multimedia:** `POST /monitoreo/evidencias/audios` y `snapshots`.
- [x] **Endpoints de Eventos Lógicos:** `POST /monitoreo/evidencias/eventos`.
- [x] **Integración Azure Blob Storage:** (Implementado mockup guardando en disco local y generando URL simulada para streaming).
- [x] **Servidor WebSocket:** Canal habilitado para feedback.
- [x] **Publicador RabbitMQ:** Eventos de audio y snapshots encolándose correctamente a `stream.audio` y `stream.vision`.
- [x] **Endpoints de Cierre (`/sesiones/start` y `/end`):** Implementados en `sesiones_evaluacion`.
- [ ] **Despliegue de Base de Datos y Redis:** Asegurar que PostgreSQL, Redis y Prisma estén conectados y probados contra el entorno de pruebas.
- [ ] **Endpoints Chaindrenciales (Configuración y Calificación):** Asegurar que las interfaces devuelvan el payload exacto de la API Spec para el frontend (`susie-config`).
- [ ] **Endpoints de Reportes:** API de lectura `/reportes/:id` para dashboard analítico de Chaindrenciales.

---

## 🧠 Equipo AI Models (Python)
**Estado:** Workers Individuales Completos, Falta Motor de Inferencia Global.
Los scripts nativos de YOLO, Whisper, DeepFace y MediaPipe funcionan con consumidores RabbitMQ integrados.

- [x] **Consumidores RabbitMQ (Workers):** ✅ — Todos los workers tienen `main.py` consumiendo de colas vía `pika` con reconexiones asíncronas.
- [ ] **Red Bayesiana (Inference Engine):** Construir el script maestro que toma las "evidencias blandas" de los 4 workers y usa la tabla de probabilidades (CPTs) para calcular fraude.
- [ ] **Retorno de Resultados al Backend:** Enviar alertas procesadas de vuelta a Fastify para inyectarlas al canal WebSocket.
- [ ] **Manejo de Errores IA:** Procesos de recuperación si falla la inferencia en un chunk corrupto.

---

## 🔄 Integración y Pruebas
**Estado:** Pendiente de E2E.

- [ ] **Pruebas Conectando Frontend al Nuevo Fastify:** Probar que el envío por `multipart/form-data` se conecte limpio al backend local de Ramírez.
- [ ] **Pruebas de Inferencia en Vivo:** Probar que al enviar un chunk de audio desde Frontend, Fastify lo pase a RabbitMQ y un Worker en Python de Whisper logre leerlo exitosamente.
- [ ] **Flujo End-to-End (E2E) Real:** Examen completo donde Chaindrenciales inicia, Frontend graba, Backend orquesta, Python infiere, y Chaindrenciales finaliza guardando resultados.
