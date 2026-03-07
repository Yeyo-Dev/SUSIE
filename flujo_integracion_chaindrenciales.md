# 🔄 Flujo de Integración Chaindrenciales ↔ SUSIE

Este documento describe el flujo completo desde que un examen es asignado a un estudiante en Chaindrenciales, la validación de identidad (registro biométrico) y el monitoreo durante la ejecución del examen en SUSIE.

## 🏗️ Arquitectura General

El flujo involucra los siguientes componentes clave:
1. **Chaindrenciales (LMS)**: Gestiona estudiantes, cursos, asignaciones de exámenes y el enrolamiento biométrico inicial.
2. **SUSIE (Frontend)**: Interfaz de supervisión que embebe la vista del examen o redirige a ella tras validar pre-requisitos de entorno y biometría.
3. **SUSIE (Backend)**: API Gateway que gestiona las sesiones de supervisión, validación en tiempo real y persistencia de eventos.
4. **RabbitMQ (Event Bus)**: Cola de mensajes que recibe evidencias asíncronas de manera optimizada y tolerante a fallos.
5. **Worker IA**: Procesador en background que consume evidencias de RabbitMQ, analiza rostros, miradas, audio y pantallas en busca de anomalías.
6. **WebSockets Server**: Canal de comunicación bidireccional en tiempo real para enviar `feedbacks` y alertas tempranas del Worker IA al FrontEnd de SUSIE.

---

## 🛤️ Flujo Paso a Paso

### Fase 1: Enrolamiento Biométrico (Chaindrenciales)
*Ocurre una única vez por estudiante, idealmente antes de su primer examen.*

1. **Chaindrenciales** solicita al estudiante enrolar su rostro por seguridad.
2. El frontend de Chaindrenciales abre la cámara y captura un snapshot frontal claro del estudiante.
3. El frontend de Chaindrenciales hace un `POST` al endpoint de registro biométrico en el backend de SUSIE:
   - `POST /susie/api/v1/usuarios/biometricos`
   - **Body (FormData)**: `meta` = `{"usuario_id": 1}`, `file` = `foto.jpg`
4. **SUSIE Backend** procesa la foto:
   - Extrae el vector facial (embeddings) garantizando que hay 1 solo rostro y tiene buena calidad.
   - Guarda el vector de referencia en la BD en la tabla `biometricos_user`.
   - Retorna HTTP `201 Created`.

### Fase 2: Lanzamiento del Examen (Handshake)
*Cuando el estudiante decide iniciar su examen en la plataforma LMS.*

1. **Chaindrenciales** genera un token seguro (JWT) que certifica la identidad del estudiante y el ID de asignación del examen. Ese token está firmado con un secreto compartido con SUSIE.
2. **Chaindrenciales** redirige o incrusta (vía IFrame) el Frontend de SUSIE, pasando los parámetros mínimos:
   - `https://susie.app/exam?asignacion_id=123&token=<JWT>`
3. **Frontend SUSIE** se inicializa:
   - Extrae los parámetros de la URL.
   - Verifica que el entorno embebido cumpla los requerimientos del navegador.
   - Realiza un `GET /susie/api/v1/evaluaciones/configuracion/:asignacion_id` autenticándose con el `token`.
   - Obtiene la configuración de seguridad estricta para esa evaluación (ej: requiere cámara, audio, prohibido cambiar tabs).
   - Obtiene el contenido del examen (preguntas y opciones) de `GET /susie/api/v1/examenes/:examen_id`.

### Fase 3: Onboarding y Pre-Checks en SUSIE
*Antes de mostrar la primera pregunta del examen.*

1. **Pantalla de Bienvenida y Consentimiento**: SUSIE muestra las reglas del examen en base a la configuración descargada (ej. "Se grabará tu audio").
2. **Chequeo de Hardware**: SUSIE solicita permisos de cámara y micrófono. Se asegura de que funcionen emitiendo flujos de media locales.
3. **Validación Biométrica (Autenticación Cero Confianza)**:
   - Si la config dicta `validacion_biometrica: true`, SUSIE pide al usuario mirar a la cámara.
   - Captura una foto silenciosa (snapshot) y la envía a `POST /susie/api/v1/usuarios/biometricos/validar`.
   - **Backend SUSIE** compara el vector de la foto en tiempo real contra el vector guardado en la `Fase 1`.
   - Retorna HTTP `200` y porcentaje de `confianza` > umbral de seguridad.
   - Si no coincide, SUSIE Frontend impide el paso, protegiendo contra suplantación en el momento cero.
4. **Calibración de Mirada**: Si la configuración dicta `requireGazeTracking`, SUSIE obliga a hacer clic en varios puntos de la pantalla para calibrar el mapeo de coordenadas visuales locales.

### Fase 4: Sesión de Examen y Monitoreo Continuo
*El estudiante está respondiendo el examen.*

1. **Crear Sesión**: Frontend SUSIE hace `POST /susie/api/v1/sesiones { "id_asignacion": 123 }`.  
   - Backend devuelve un `id_sesion` inmutable "activa".
2. **Conexión WebSockets**: Frontend abre túnel WS hacia el Backend usando el `id_sesion`.
3. **Captura Asíncrona (Stream de Evidencias)**:
   - El frontend entra en ciclo de captura usando `MediaRecorder` y el DOM.
   - Cada *N* segundos envía un snapshot a `POST /susie/api/v1/monitoreo/evidencias/snapshots`.
   - Cada *15* segundos envía un bloque de Opus audio a `POST /susie/api/v1/monitoreo/evidencias/audios`.
   - Cada *5* segundos envía el historial de coordenadas (x,y) de la mirada al backend.
4. **Ingesta y Enrutamiento (Backend)**:
   - Los endpoints de evidencias del Backend guardan el archivo binario crudo en Blob Storage/Disco.
   - El Backend publica un mensaje de evento en **RabbitMQ** (ej. Topic `stream.snapshot` o `stream.audio`) conteniendo la URL del blob y la metadata.
   - Responde rápido al Frontend con `200 OK` (Operación Fire & Forget).
5. **Worker de Inteligencia Artificial (Proceso Aislado)**:
   - Consume encoladamente de RabbitMQ sin bloquear la API principal.
   - Ojo IA: YOLO / OpenCV detecta presencia de múltiples personas, ausencia, o celulares.
   - Audio IA: Whisper o VAD detectan voz humana externa.
   - Si el Worker detecta anomalía, inyecta un registro en la tabla `infracciones` de BD e instruye al servidor WebSocket emitir un mensaje de "Alerta".
6. **Feedback Tiempo Real**:
   - El WebSocket Server hace un 'push' al FrontEnd SUSIE.
   - FrontEnd SUSIE muestra modal o tooltip discreto: "Por favor, mantén tu rostro dentro del encuadre".
7. **Eventos de Navegador Local**:
   - SUSIE detecta salir de "Fullscreen", "Cambiar Tab", etc. localmente.
   - Lo reporta inmediatamente a `POST /susie/api/v1/monitoreo/infracciones` sin enviar binarios pesados.

### Fase 5: Finalización y Reporte
*El estudiante termina el examen o se acaba el tiempo.*

1. **Fin de Navegación**: SUSIE bloquea la pantalla de examen y fuerza envío de las respuestas.
2. **Fin de Sesión Seguridad**: Frontend SUSIE llama `POST /susie/api/v1/sesiones/finalizar/:id_sesion`.
   - Backend cambia estado a `FINALIZADA` e ignora futuras evidencias de esta sesión.
3. **Webhook de Resultados**: SUSIE Backend hace un llamado (Webhook) confiable hacia al Backend de Chaindrenciales:
   - `POST https://chaindrenciales.api/callbacks/examen_finalizado`
   - El payload lleva puntaje, y si la sesión está "limpia" o "sospechosa".
4. **Pantalla Final**: Frontend SUSIE muestra UI de "Examen Completado" informando ID de sesión que sirve de rastreabilidad técnica y estadística final (duración, cantidad de fotos tomadas).
