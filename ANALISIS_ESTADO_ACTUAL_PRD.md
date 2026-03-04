# Análisis de Estado Actual vs PRD SUSIE

> **Fecha:** 3 de Marzo de 2026

Este documento detalla el estado real de implementación de SUSIE contrastado con el **Documento de Requisitos de Producto (PRD) v1.0**, desglosando exactamente qué componentes ya existen y cuáles faltan en cada área (Frontend, Backend, AI Models).

---

## 🟢 1. Frontend (Angular - ngx-susie-proctoring)
**Nivel de completitud real: ~90%**

El frontend es la capa más avanzada del ecosistema. Todo el motor del examen y la coreografía de proctoring están listos.

### ✅ Lo que YA ESTÁ implementado:
- **Motor de Examen (RF-001 a RF-004):** UI de preguntas, paginación, temporizador, auto-submit.
- **Onboarding y Permisos (RF-005 a RF-007):** Solicitud A/V, Modal de TyC, Onboarding biométrico (UI y validación de cara detectada, con llamadas API de enrollment integradas).
- **Proctoring y Sensores (RF-009 a RF-016):** Fullscreen lock, Tab tracking, Copy/paste block, DevTools block, Snapshots en WebWorker, Grabación y envío de Audio WebM cada 15s.
- **Canal de Feedback (Nuevo):** Integración de WebSocket nativo para recibir alertas de IA (con overlay UI y backoff reconnection).
- **Actualización de Contratos:** Payload alineado con la especificación final y backend.

### ❌ Lo que FALTA (Brechas):
- **[F-03] Tolerancia a Fallas Offline (RNF-008):** Cola de reintentos basada en IndexedDB. Si la red cae hoy, las evidencias que fallan en enviarse se pierden. *(Alta prioridad para estabilidad bajo malas redes)*.
- **[F-06] Gaze Tracking:** Falta enviar las coordenadas de mirada / calibración a la lógica de evaluación (requiere backend listo).
- **[F-08] Tests Unitarios:** La suite de pruebas de los nuevos servicios (Evidence, Security, Feedback) está vacía o incompleta.

---

## 🟡 2. Backend (Fastify API Gateway)
**Nivel de completitud real: ~30-40%**

El backend contiene el esqueleto y configuración del bus de RabbitMQ, pero le falta la lógica transaccional de los workers y los endpoints finales.

### ✅ Lo que YA ESTÁ implementado:
- **Infraestructura Base:** Fastify configurado, `app.ts`, `server.ts`.
- **Estructura de Módulos:** Enrutador base.

### ❌ Lo que FALTA (Brechas):
- **[B-01] Endpoints Biométricos Reales (RF-007):** El frontend llama a `/biometrics/enroll` y `/verify`, pero el código del backend para manejar las imágenes con el worker de Python no está finalizado.
- **[B-05] Servidor WebSocket:** El frontend ya intenta conectarse a `ws://.../monitoreo/feedback`, pero el servidor backend NO expone esta ruta WebSocket todavía.
- **[B-04] Endpoints de Reportes (Caso 7.3):** Falta la API de lectura `/reportes/:id` para que Chaindrenciales dibuje el dashboard.
- **[B-06] Colas RabbitMQ y Azure (RF-013 a RF-015):** La persistencia real de las evidencias en Azure Blob y la publicación cruzada a `susie.ai.vision` o `susie.ai.audio` no está terminada de probar end-to-end.
- **[B-07] Motor de Riesgo Central:** El algoritmo probabilístico integrador que emite el reporte final y score.

---

## � 3. AI Models (Python Workers)
**Nivel de completitud real: ~75%**

Contrario a la estimación inicial, la carpeta `ai_models` contiene una implementación muy robusta y madura de la lógica de negocio predictiva.

### ✅ Lo que YA ESTÁ implementado (Lógica Core):
- **Worker YOLO (`vision_yolo`):** Lógica lista cargando `yolov8n.pt`. Detecta de forma precisa personas y celulares. Implementa Regla de Tolerancia Cero para celulares (Score 1.0) y sospecha (Score 0.6 o 0.9) si el usuario desaparece o hay múltiples personas.
- **Worker Whisper (`audio_whisper`):** Pipeline end-to-end muy avanzado que descarga el WebM de Azure Blob, aplica un filtro de voz, detecta silencio (generando un vector neutral para la red Bayesiana), transcribe usando Faster-Whisper, y pasa el texto a un analizador semántico NLP que genera probabilidad de trampa o ambiente doméstico aplicando Softmax con temperatura.
- **Worker DeepFace (`biometric_deepface`):** Lógica funcional usando `face_recognition` (modelo HOG) para extraer los embeddings de 128 dimensiones limpiando la imagen con OpenCV a RGB uint8. Incluye el cálculo de distancia euclidiana para determinar math (`similarity > 0.5`).
- **Worker MediaPipe (`gaze_mediapipe`):** Algoritmo extremadamente avanzado que filtra el ruido de microsaltos (saccade noise) y usa Machine Learning no supervisado (`DBSCAN` para agrupar focos visuales y detectar segundas pantallas, e `IsolationForest` para anomalías). Todo reportado como ratios para la Red Bayesiana.

### ❌ Lo que FALTA (Brechas):
- **Consumidores RabbitMQ:** Aunque la lógica (`vision_logic.py`, `worker.py`, `analyzer.py`) está hecha para recibir urls/numpy arrays y retornar JSONs con scores, **falta el loop principal que escuche las colas de RabbitMQ** (ej. `pika` o `aio_pika`) para detonar estas funciones y enviar la respuesta al backend.
- **Motor de Inferencia Global (Red Bayesiana):** Los workers retornan "soft evidence", pero falta el nodo consolidador o framework (como pgmpy) que recibe todos estos inputs para calcular el Score Final de Riesgo.

---

## ⚖️ Contradicciones Detectadas en Archivos Markdown (Resueltas hoy)

1. **ARCHITECHTURE vs CONTRATO vs PRD en WebSockets:**
   - *El Problema:* El PRD no mencionaba WebSockets originalmente (en RF decía HTTPS POST). El backend solo hablaba de APIs REST síncronas.
   - *La Realidad:* Se determinó e implementó (hoy) que el feedback DEBE ser asíncrono y en tiempo real para alertar al alumno si sale de cámara sin esperar un request/response.
   - *Estado:* Ya fue corregido en `CONTRATO_INTEGRACION_BACKEND.md` (sección 6).
2. **Roadmap Desalineado:**
   - *El Problema:* `ROADMAP_TAREAS.md` y `TAREAS_FRONTEND_PENDIENTES.md` listaban tareas de Biometría, WebSockets y Contratos como pendientes.
   - *La Realidad:* Ya fueron construidas en el frontend.
   - *Estado:* Actualizados al 90% para reflejar la realidad en esta sesión.

## Conclusión y Próximos Pasos (Blockers)

El **Frontend está gravemente bloqueado por la falta de implementación en Backend y AI**.
Para que SUSIE sea un producto testeable "End to End", el paso más urgente es:
1. Crear el Servidor **WebSocket** en el Backend para cerrar el loop de Feedback.
2. Implementar los endpoints POST físicos de **Biometría** y **Subida de Evidencias** (con RabbitMQ publicando a los Workers).
3. Construir los scripts de **Python (DeepFace y YOLO)** mínimos viables para responder validaciones de rostro.

La siguiente tarea inmediata para Frontend (última grande del PRD) es: **[F-03] Cola de reintentos offline (IndexedDB)**.
