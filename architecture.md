# Arquitectura del Sistema SUSIE

## 1. Visión General
SUSIE utiliza una arquitectura de **Microservicios Orientada a Eventos (Event-Driven)**. Esto permite desacoplar los componentes de captura (Frontend), procesamiento (IA) y persistencia (Backend), facilitando el desarrollo paralelo y la escalabilidad.

### Principio "Contract First"
La comunicación entre servicios se rige por contratos JSON estrictos definidos previamente. Esto permite que el Frontend envíe datos y el Backend los reciba sin esperar a que los modelos de IA estén completamente entrenados.

---

## 2. Componentes del Sistema

### Capa 1: Frontend (Captura y Cliente)
*   **Responsable:** Vielma (Residente 1)
*   **Tecnologías:** Angular 17+, PrimeNG, MediaDevices API.
*   **Rol:**
    *   **Captura:** Obtiene streams de video y audio del usuario.
    *   **Proctoring:** Implementa bloqueos (full-screen, focus tracking).
    *   **Envío:** Envía "evidencias" (snapshots, audio chunks) y metadatos al API Gateway.
    *   **Feedback:** Recibe alertas en tiempo real (vía WebSockets/Polling) para mostrar al reclutador o advertir al alumno.

### Capa 2: API Gateway (Entrada)
*   **Responsable:** Ramírez (Residente 3)
*   **Tecnologías:** Node.js, Fastify.
*   **Rol:**
    *   **Punto Único de Entrada:** Recibe todas las peticiones del Frontend.
    *   **Autenticación:** Valida JWT.
    *   **Orquestación Simple:**
        1.  Recibe imagen/audio.
        2.  Sube archivo "crudo" a **Azure Blob Storage**.
        3.  Obtiene URL del archivo.
        4.  Publica un mensaje (evento) en el **Event Bus** con la URL y metadatos.
    *   **Respuesta Rápida:** Devuelve "200 OK" al Frontend inmediatamente tras encolar el mensaje ("Fire and Forget" para el cliente).

### Capa 3: Event Bus (Comunicación Asíncrona)
*   **Tecnologías:** RabbitMQ.
*   **Rol:**
    *   Desacopla productores (API Gateway) de consumidores (IA Workers).
    *   Gestiona colas de mensajes para distribuir la carga de trabajo de inferencia.

### Capa 4: AI Services (Consumidores Inteligentes)
*   **Responsable:** Vargas (Residente 2)
*   **Tecnologías:** Python, Workers aislados.
*   **Modelos:**
    1.  **Visión Artificial (YOLOv26):** Detección de objetos prohibidos (celulares, personas extra) y personas.
    2.  **Gaze Tracking (MediaPipe):** Análisis de la dirección de la mirada (atención).
    3.  **Audio Analysis (FastWhisper):** Transcripción y detección de palabras clave o voces múltiples.
    4.  **Biometría (DeepFace):** Verificación de identidad contra la foto de referencia.
*   **Funcionamiento:**
    *   Escuchan la cola de RabbitMQ.
    *   Descargan la evidencia desde la URL de Azure.
    *   Procesan y generan un resultado (probabilidad, etiqueta).
    *   Publican el resultado en una cola de salida o actualizan el Motor de Inferencia.

### Capa 5: Motor de Inferencia (Lógica Probabilística)
*   **Tecnologías:** Python, pgmpy (Redes Bayesianas / Naive Bayes).
*   **Rol:**
    *   Recibe los inputs individuales de los modelos (ej. "YOLO vio un celular 90%", "Gaze dice que miró a la derecha").
    *   Calcula la probabilidad conjunta de fraude.
    *   Determina el nivel de riesgo (Alto, Medio, Bajo).

### Capa 6: Persistencia e Infraestructura
*   **Responsable:** Ramírez (Residente 3)
*   **Tecnologías:**
    *   **PostgreSQL:** Datos estructurados (usuarios, sesiones, logs de eventos, resultados).
    *   **Redis:** Caché de sesión y estados transitorios rápidos.
    *   **Azure Blob Storage:** Almacenamiento de evidencias multimedia (imágenes, audio).
    *   **Docker:** Contenerización de todos los servicios.

---

## 3. Flujo de Datos (Ejemplo: Detección de Celular)
1.  **Frontend** captura un frame de video.
2.  **Frontend** envía frame al **API Gateway** (Fastify).
3.  **Gateway** sube imagen a **Azure** -> Obtiene `url_imagen`.
4.  **Gateway** publica evento en **RabbitMQ**: `{ tipo: "ANALIZAR_FRAME", url: "...", session_id: "123" }`.
5.  **Gateway** responde `200 OK` al Frontend.
6.  **Worker YOLO** toma el evento, descarga imagen de `url_imagen`.
7.  **Worker YOLO** detecta "celular" (confianza 0.95).
8.  **Worker YOLO** envía resultado al **Motor de Inferencia**.
9.  **Motor de Inferencia** actualiza riesgo de la sesión y guarda en **Postgres**.
10. (Opcional) **Gateway** notifica al Dashboard del Reclutador vía WebSocket si el riesgo es alto.
