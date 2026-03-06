# Análisis de Estado Actual vs PRD SUSIE

> **Fecha:** 6 de Marzo de 2026

Este documento detalla el estado real de implementación de SUSIE contrastado con el **Documento de Requisitos de Producto (PRD) v1.0**, desglosando qué componentes ya existen y cuáles faltan en cada área (Frontend, Backend, AI Models), actualizado con los desarrollos más recientes.

---

## 🟢 1. Frontend (Angular - ngx-susie-proctoring)
**Nivel de completitud real: ~95%**

El frontend es la capa más avanzada del ecosistema. Todo el motor del examen y la coreografía de proctoring están listos y se han integrado exitosamente módulos clave.

### ✅ Lo que YA ESTÁ implementado:
- **Motor de Examen (RF-001 a RF-004):** UI de preguntas, paginación, temporizador, auto-submit. Se eliminaron los datos mockeados.
- **Onboarding y Permisos (RF-005 a RF-007):** Solicitud A/V, Modal de TyC, Onboarding biométrico (UI dedicada, validación de cara detectada, llamadas API de enrollment integradas).
- **Proctoring y Sensores (RF-009 a RF-016):** Fullscreen lock, Tab tracking, Copy/paste block, DevTools block, Snapshots en WebWorker, Grabación y envío de Audio WebM cada 15s.
- **Canal de Feedback:** Integración de WebSocket nativo para recibir alertas de IA.
- **Gaze Tracking (RF-016):** Calibración de mirada, tracking y envío continuo de coordenadas al backend para el heatmap.
- **Robustez de Seguridad:** Prevención mejorada contra pérdida de foco, cambio de escritorio virtual, atajos de teclado para herramientas de desarrollo y bloqueo de clic derecho.

### ❌ Lo que FALTA (Brechas):
- **[F-03] Tolerancia a Fallas Offline (RNF-008):** Cola de reintentos basada en IndexedDB. Si la red cae, las evidencias que fallan en enviarse se pierden. *(Prioridad para estabilidad bajo malas redes)*.
- **[F-08] Tests Unitarios:** La suite de pruebas de los nuevos servicios está vacía o incompleta (Evidence, Security, Feedback).

---

## 🟢 2. Backend (Fastify API Gateway)
**Nivel de completitud real: ~92%**

El backend tiene la infraestructura lista para recibir tráfico pesado y comunicarse con la IA.

### ✅ Lo que YA ESTÁ implementado:
- **Infraestructura Base & Logs:** Fastify configurado. Integración de Logger Pino optimizado, logs de requests de colas. Remoción de datos simulados en favor de extracción real de DB.
- **Recepción de Evidencias (Multipart):** Recepción de audio y fotos en `monitoreo/audios`, `monitoreo/snapshots`, y recepción de datos de gaze tracking.
- **Servidor WebSocket:** El canal de feedback está registrado y operando.
- **Colas RabbitMQ:** Publicación a colas configurada correctamente, integraciones base listas.
- **Control de Infracciones y Sesiones:** Endpoints integrados para control de evaluación.

### ❌ Lo que FALTA (Brechas):
- **[B-04] Endpoints de Reportes (Caso 7.3):** Falta la API de lectura `/reportes/:id` para que Chaindrenciales dibuje el dashboard analítico.
- **[B-07] Motor de Riesgo Central:** Integración con el algoritmo probabilístico final que recibirá la respuesta de los AI Models.

---

## 🟡 3. AI Models (Python Workers)
**Nivel de completitud real: ~85%**

La lógica de negocio predictiva está implementada y lista para ser consumida.

### ✅ Lo que YA ESTÁ implementado (Lógica Core y workers):
- **Worker YOLO (`vision_yolo`):** Extrae características y soft evidence de personas y celulares.
- **Worker Whisper (`audio_whisper`):** Pipeline end-to-end con filtro de voz, transcripción Faster-Whisper, y analizador NLP para trampa vs ambiente.
- **Worker DeepFace (`biometric_deepface`):** Extrae embeddings faciales (128D) verificando similitud (`similarity > 0.5`).
- **Worker MediaPipe (`gaze_mediapipe`):** Algoritmo DBSCAN e IsolationForest para focus noise y anomalías.
- **Capa de Transporte:** Todos los workers tienen implementado su script `main.py` consumiendo eventos de RabbitMQ vía reconexiones asíncronas de `pika`.

### ❌ Lo que FALTA (Brechas):
- **Motor de Inferencia Global (Red Bayesiana):** Falta construir el nodo central/framework (ej. usando `pgmpy`) que escuche las distribuciones de soft evidence generadas por todos los workers y calcule el Score Final de Riesgo consolidado.

---

## Conclusión y Próximos Pasos (Blockers)

Con los recientes avances en *Gaze Tracking, Biometría UI Frontend, Seguridad Robusta* y los *Consumidores de RabbitMQ en AI*, el sistema ha dado saltos grandes hacia el estado MVP E2E funcional.

**Pasos urgentes para lograr un E2E completo:**
1. Construir el **Motor de Inferencia Global** (Red Bayesiana) en IA para que las detecciones de YOLO, Whisper, DeepFace y MediaPipe converjan en una sola probabilidad de fraude procesable por el backend.
2. Implementar los **Endpoints de Reportes** en el Backend para que organizaciones visualicen resúmenes de proctoring.
3. (Opcional pero crítico en producción): **Cola de reintentos offline (IndexedDB)** en el Frontend.
