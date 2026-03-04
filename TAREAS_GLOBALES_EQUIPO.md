# 📋 Tareas Pendientes Globales (SUSIE)
> **Fecha de Actualización:** Marzo 2026
> **Estado General:** Frontend (~90%), AI Models (~75%), Backend (~90%)

Este documento consolida todas las tareas faltantes para completar el sistema SUSIE, divididas por equipo responsable. Es el documento fuente para la asignación de próximos sprints.

---

## 💻 Equipo Frontend (Vielma)
**Estado:** Fase Final (Cierres y Resiliencia)
El core de supervisión, grabación, reglas e UI está construido. Faltan detalles de estabilización.

- [ ] **Resiliencia Offline (IndexedDB):** Implementar la cola de reintentos para cuando falla el envío asíncrono de un chunk de audio o un snapshot debido a micro-cortes de red.
- [ ] **Integración Gaze Tracking:** Ajustar el envío de eventos de pérdida de mirada hacia la API, una vez que el backend esté listo para recibirlos.
- [x] **UI de Alertas (WebSocket):** Escuchar el canal de WebSocket del backend y mostrar en pantalla alertas en vivo amigables (ej. "Por favor, vuelve a mirar a la cámara").
- [ ] **Validación Biométrica Inicial:** Integrar la pantalla de captura de foto inicial (Onboarding) de acuerdo al flujo de inscripción antes de iniciar el examen. *(En progreso con SDD)*.
- [ ] **Pruebas E2E y Unitarias:** Completar la cobertura de tests para el componente principal (`susie-wrapper`).

---

## ⚙️ Equipo Backend (Fastify/Node.js)
**Estado:** Fase Final (Endpoints construidos, faltan validaciones conjuntas)
El backend ha completado la refactorización mayor (Multipart, WebSockets, RabbitMQ). Falta conectar con Chaindrenciales.

- [x] **Endpoints de Recepción Multimedia:** `POST /monitoreo/evidencias/audios` y `snapshots`.
- [x] **Endpoints de Eventos Lógicos:** `POST /monitoreo/evidencias/eventos`.
- [x] **Integración Azure Blob Storage:** (Implementado mockup guardando en disco local y generando URL simulada para streaming).
- [x] **Servidor WebSocket:** Canal habilitado para feedback.
- [x] **Publicador RabbitMQ:** Eventos de audio y snapshots encolándose correctamente a `stream.audio` y `stream.vision`.
- [x] **Endpoints de Cierre (`/sesiones/start` y `/end`):** Implementados en `sesiones_evaluacion`.
- [ ] **Despliegue de Base de Datos y Redis:** Asegurar que PostgreSQL, Redis y Prisma estén conectados y probados contra el entorno de pruebas.
- [ ] **Endpoints Chaindrenciales (Configuración y Calificación):** Asegurar que las interfaces devuelvan el payload exacto de la API Spec para el frontend (`susie-config`).

---

## 🧠 Equipo AI Models (Python)
**Estado:** Lógica Aislada Completa, Falta Integración Continua.
Los scripts nativos de YOLO, Whisper, DeepFace y MediaPipe funcionan, pero faltan conectarlos al flujo en vivo de Fastify.

- [ ] **Consumidores RabbitMQ (Workers):** Envolver cada script de IA en un consumidor `pika` que escuche las colas (`stream.audio`, `stream.vision`) recién alimentadas por el Backend.
- [ ] **Red Bayesiana (Inference Engine):** Construir el script maestro que toma las "evidencias blandas" de los 4 workers y usa la tabla de probabilidades (CPTs) para calcular fraude.
- [ ] **Retorno de Resultados al Backend:** Enviar alertas procesadas de vuelta a Fastify para inyectarlas al canal WebSocket.
- [ ] **Manejo de Errores IA:** Procesos de recuperación si falla la inferencia en un chunk corrupto.

---

## 🔄 Integración y Pruebas
**Estado:** Pendiente de E2E.

- [ ] **Pruebas Conectando Frontend al Nuevo Fastify:** Probar que el envío por `multipart/form-data` se conecte limpio al backend local de Ramírez.
- [ ] **Pruebas de Inferencia en Vivo:** Probar que al enviar un chunk de audio desde Frontend, Fastify lo pase a RabbitMQ y un Worker en Python de Whisper logre leerlo exitosamente.
- [ ] **Flujo End-to-End (E2E) Real:** Examen completo donde Chaindrenciales inicia, Frontend graba, Backend orquesta, Python infiere, y Chaindrenciales finaliza guardando resultados.
