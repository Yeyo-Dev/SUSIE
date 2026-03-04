# 📋 Tareas Pendientes Globales (SUSIE)
> **Fecha de Actualización:** Marzo 2026
> **Estado General:** Frontend (~90%), AI Models (~75%), Backend (~40%)

Este documento consolida todas las tareas faltantes para completar el sistema SUSIE, divididas por equipo responsable. Es el documento fuente para la asignación de próximos sprints.

---

## 💻 Equipo Frontend (Vielma)
**Estado:** Fase Final (Cierres y Resiliencia)
El core de supervisión, grabación, reglas e UI está construido. Faltan detalles de estabilización.

- [ ] **Resiliencia Offline (IndexedDB):** Implementar la cola de reintentos para cuando falla el envío asíncrono de un chunk de audio o un snapshot debido a micro-cortes de red.
- [ ] **Integración Gaze Tracking:** Ajustar el envío de eventos de pérdida de mirada hacia la API, una vez que el backend esté listo para recibirlos.
- [ ] **UI de Alertas (WebSocket):** Escuchar el canal de WebSocket del backend y mostrar en pantalla alertas en vivo amigables (ej. "Por favor, vuelve a mirar a la cámara"). *(En progreso con SDD)*.
- [ ] **Validación Biométrica Inicial:** Integrar la pantalla de captura de foto inicial (Onboarding) de acuerdo al flujo de inscripción antes de iniciar el examen. *(En progreso con SDD)*.
- [ ] **Pruebas E2E y Unitarias:** Completar la cobertura de tests para el componente principal (`susie-wrapper`).

---

## ⚙️ Equipo Backend (Fastify/Node.js)
**Estado:** Desarrollo Activo (Bloqueante Principal)
El backend es el cuello de botella actual. Necesita implementar los endpoints que el frontend ya espera.

- [ ] **Endpoints de Recepción Multimedia:** Implementar `POST /monitoreo/evidencias/audios` y `snapshots` usando `@fastify/multipart`.
- [ ] **Endpoints de Eventos Lógicos:** Implementar `POST /monitoreo/evidencias/eventos` para registrar anomalías puras (JSON).
- [ ] **Integración Azure Blob Storage:** Conectar la recepción de archivos (audios/fotos) para que se suban directamente a Azure y guardar la URL resultante en BD (`infracciones_evaluacion`).
- [ ] **Servidor WebSocket:** Levantar el canal para notificar feedback en tiempo real al usuario.
- [ ] **Publicador RabbitMQ:** Al recibir evidencias, el backend debe encolar el trabajo en RabbitMQ para que los AI Models lo procesen.
- [ ] **Endpoints de Cierre:** Crear los endpoints `/sesiones/start` y `/end` que guardan el estado final del intento.
- [ ] **Endpoints Chaindrenciales (Recepción):** Proveer la configuración inicial (`susie-config`) y recibir los resultados del examen calificado para guardarlos.

---

## 🧠 Equipo AI Models (Python)
**Estado:** Lógica Aislada Completa, Falta Integración Continua.
Los scripts nativos de YOLO, Whisper, DeepFace y MediaPipe funcionan, pero faltan conectarlos al flujo en vivo.

- [ ] **Consumidores RabbitMQ (Workers):** Envolver cada script de IA (audio, biometría, visión, mirada) en un consumidor `pika` que escuche las colas alimentadas por el Backend.
- [ ] **Red Bayesiana (Inference Engine):** Construir el script maestro que toma las "evidencias blandas" de los 4 workers y usa la tabla de probabilidades (CPTs) para calcular el `% de fraude final`.
- [ ] **Retorno de Resultados al Backend:** Enviar las alertas críticas y resultados de vuelta al backend (quizás por otra cola o webhook) para que Fastify notifique por WebSocket o guarde en BD.
- [ ] **Manejo de Errores IA:** Procesos de recuperación si falla la inferencia en un chunk corrupto.

---

## 🔄 Integración y Pruebas
**Estado:** Pendiente. Al finalizar los componentes individuales.

- [ ] **Flujo End-to-End (E2E) Real:** Disparar un examen completo en frontend, verificar que las imágenes llegan a Azure, la BD guarda los registros, los workers de IA detectan anomalías y el score final se reporta correctamente a Chaindrenciales.
- [ ] **Test de Carga:** Probar qué pasa si 100 alumnos abren un examen simultáneamente (carga en RabbitMQ y Fastify).
