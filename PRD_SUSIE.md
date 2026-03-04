# Documento de Requisitos de Producto (PRD)

## SUSIE — Sistema de Supervisión Inteligente de Evaluaciones

| Campo | Detalle |
|-------|---------|
| **Versión** | 1.0 |
| **Fecha** | 2 de Marzo de 2026 |
| **Estado** | Activo |
| **Proyecto** | SUSIE — Sistema de Supervisión Inteligente de Evaluaciones |
| **Tipo** | Producto de Proctoring con Motor de Exámenes Integrado |

---

## 1. Introducción y Propósito

### 1.1 Propósito del Documento

Este Documento de Requisitos de Producto (PRD) tiene como objetivo definir de manera exhaustiva las especificaciones, funcionalidades, restricciones y arquitectura del sistema SUSIE (Sistema de Supervisión Inteligente de Evaluaciones). El documento sirve como referencia única y autoritativa para todos los equipos involucrados en el desarrollo, integración y despliegue del sistema, incluyendo el equipo de frontend, backend, inteligencia artificial e infraestructura.

El propósito fundamental de SUSIE es proporcionar una solución completa de supervisión de exámenes en línea que permita a instituciones educativas y empresas evaluar candidates de manera remota con altos niveles de integridad y seguridad. SUSIE no funciona simplemente como un overlay o capa de superposición sobre sistemas existentes, sino que constituye un motor de exámenes completo que reemplaza al visor de evaluaciones estándar de la plataforma Chaindrenciales cuando se requiere supervisión asistida por tecnología.

### 1.2 Visión del Producto

SUSIE busca transformar la manera en que se realizan las evaluaciones remotas, eliminando o reduciendo significativamente las posibilidades de fraude académico mediante la combinación de tecnologías de supervisión activa, análisis biométrico, tracking de comportamiento y procesamiento inteligente de evidencias. La visión a largo plazo es posicionar a SUSIE como una solución escalable y configurable que pueda integrarse con múltiples plataformas de gestión de exámenes, no limitándose únicamente a Chaindrenciales.

La solución opera bajo un modelo de arquitectura basada en eventos que permite el procesamiento asíncrono de evidencias, desacoplando la experiencia del candidato (que debe ser fluida y sin interrupciones) del análisis posterior de las grabaciones y eventos recopilados durante la sesión de evaluación.

---

## 2. Alcance del Producto

### 2.1 Alcance Incluido

El alcance de SUSIE comprende los siguientes componentes y funcionalidades principales que constituyen el núcleo del producto:

El primer componente es el **Motor de Exámenes**, que incluye la presentación de preguntas con soporte para múltiples tipos de cuestionarios, un temporizador configurable que muestra el tiempo restante al candidato, paginación entre preguntas con estado persistente, y la funcionalidad de submit manual o automático por timeout.

El segundo componente es el **Sistema de Proctoring Activo**, que abarca la captura continua de video desde la cámara web del candidato, grabación de audio del entorno mediante micrófono, snapshots periódicos del estado del candidato, detección de eventos de seguridad como cambios de pestaña, pérdida de foco del navegador, intentos de apertura de DevTools, y forzamiento de modo pantalla completa durante el examen.

El tercer componente es el **Módulo de Biometría**, que comprende el enrolamiento facial inicial del candidato durante el onboarding, verificación de identidad en tiempo real comparando contra la foto de referencia, y generación de embeddings biométricos para comparación posterior sin almacenar imágenes faciales en bruto.

El cuarto componente es el **Sistema de Captura de Evidencias**, que incluye el envío asíncrono de chunks de audio cada 15 segundos en formato WebM, snapshots periódicos y event-triggered en formato JPEG, eventos lógicos del navegador (JSON puro) documentando anomalías, y almacenamiento en Azure Blob Storage con URLs firmadas.

El quinto componente es el **Backend de Procesamiento**, que consiste en un API Gateway implementado en Fastify, un bus de eventos mediante RabbitMQ para procesamiento asíncrono, workers de inteligencia artificial para análisis de objetos (YOLO), verificación facial (DeepFace), análisis de mirada (MediaPipe), y transcripción de audio (Whisper), junto con persistencia en PostgreSQL y Redis.

### 2.2 Alcance Excluido

Quedan explícitamente fuera del alcance inicial de SUSIE los siguientes elementos: la gestión del banco de preguntas y la creación de exámenes (funcionalidad que permanece en Chaindrenciales), la calificación automática de respuestas (excepto la comparación de respuestas correctas contra incorrectas), la generación de certificados o documentos de resultados finales, la integración con otros sistemas de gestión de aprendizaje (LMS) más allá de Chaindrenciales, y el soporte para dispositivos móviles (inicialmente solo desktop).

### 2.3 Suposiciones Clave

El desarrollo de SUSIE se fundamenta en las siguientes suposiciones que deben validarse durante el proyecto: el navegador del candidato tendrá acceso a cámara y micrófono functioning correctamente, existirá conectividad a internet estable durante toda la sesión de examen, Chaindrenciales proporcionará la infraestructura necesaria para desplegar el backend de SUSIE (o se utilizará infraestructura compartida), y los candidatos recibirán instrucciones previas sobre los requisitos técnicos del examen.

---

## 3. Definición del Problema

### 3.1 Contexto del Problema

Las evaluaciones en línea representan un desafío significativo para instituciones educativas y empresas que necesitan validar las competencias de candidates de manera remota. El problema central radica en la dificultad para garantizar la integridad de los exámenes cuando el candidato no está físicamente supervisado por un humano. Los métodos tradicionales de evaluación en línea presentan múltiples vulnerabilidades que pueden ser explotadas por candidates deshonestos, lo que devalúa la certificación y afecta la公平idad del proceso selectivo.

Entre las vulnerabilidades más comunes se encuentran el uso de dispositivos electrónicos auxiliary (teléfonos, tablets, laptops adicionales), la consulta de materiales de apoyo no autorizados (libros, notas, pantallas externas), la asistencia de terceras personas durante el examen, la suplantación de identidad (otra persona rindiendo el examen), y la manipulación del entorno del navegador mediante herramientas de desarrollo.

### 3.2 Impacto del Problema

La falta de un sistema robusto de supervisión tiene consecuencias significativas para las organizaciones: la devaluación de las certificaciones otorgadas debido a la falta de confianza en su integridad, el daño reputacional cuando se descubren fraudes post-exam, los costos adicionales de supervisión humana cuando se requiere alta seguridad, la exclusión de candidates honestos que compiten desigualmente contra ceux que hacen trampa, y la complejidad operativa para revisar manualmente grabaciones de exámenes.

### 3.3 Propuesta de Solución

SUSIE aborda este problema mediante un enfoque integral que combina tecnologías de computer vision, procesamiento de audio, análisis comportamental e inteligencia artificial para crear un ecosistema de supervisión que disuade el fraude, detecta anomalías en tiempo real, y genera evidencias detalladas para revisión posterior. El sistema permite configurar el nivel de supervisión según las necesidades del examen, desde modalidades básicas sin cámara hasta proctoring completo con biometría y análisis de mirada.

---

## 4. Stakeholders y Roles

### 4.1 Stakeholders Principales

Los stakeholders del proyecto SUSIE se dividen en varias categorías que reflejan los diferentes intereses y responsabilidades dentro del ecosistema:

**Stakeholders de la Organización (Chaindrenciales):** El reclutador o administrador de recursos humanos crea los exámenes, configura los parámetros de supervisión, asigna candidatos a evaluaciones, recibe los resultados y métricas de proctoring, y toma decisiones sobre la validez de los exámenes basándose en las evidencias. El evaluador o certificador revisa los reportes de supervisión cuando un examen es marcado como sospechoso, analiza las evidencias (snapshots, audio, timeline de violaciones), y determina si el examen debe ser validado o invalidado.

**Stakeholders del Equipo de Desarrollo:** El líder de frontend y sensores (Vielma) es responsable de construir la librería ngx-susie-proctoring en Angular, implementar la orquestación de componentes (consentimiento, biometría, motor de preguntas, captura), y gestionar el empaquetado NPM. El equipo de backend (Ramírez) desarrolla el API Gateway en Fastify, configura RabbitMQ y la infraestructura de colas, e implementa endpoints de recepción de evidencias. El equipo de inteligencia artificial (Vargas) desarrolla y mantiene los modelos YOLO (detección de objetos), DeepFace (verificación facial), MediaPipe (análisis de mirada), y Whisper (transcripción de audio).

**Stakeholders del Candidato:** El candidato es el usuario final que interactúa directamente con la librería de proctoring en su navegador, otorga permisos de cámara y micrófono, completa el proceso de consentimiento, realiza el onboarding biométrico, responde las preguntas del examen, y recibe feedback sobre el progreso y finalización del examen.

---

## 5. Requisitos Funcionales

### 5.1 Requisitos del Motor de Exámenes

El motor de exámenes de SUSIE debe cumplir con los siguientes requisitos funcionales que definen su comportamiento core:

**RF-001: Carga de Configuración de Examen** — El sistema debe poder recibir una configuración completa del examen mediante la interfaz SusieExamConfig, incluyendo el contexto de sesión (examSessionId, examId, durationMinutes), las políticas de seguridad (requireCamera, requireMicrophone, requireBiometrics, maxTabSwitches, inactivityTimeoutMinutes), las preguntas del examen sin incluir la respuesta correcta, y las credenciales de API (apiUrl, authToken).

**RF-002: Presentación de Preguntas** — El sistema debe presentar las preguntas del examen de manera secuencial o en modo navegación libre, según la configuración, mostrar el texto de la pregunta y las opciones de respuesta disponibles, permitir la selección de una única respuesta por pregunta, y mantener el estado de las respuestas seleccionadas incluso si el candidato cambia entre preguntas.

**RF-003: Gestión del Temporizador** — El sistema debe mostrar un temporizador visible con el tiempo restante hasta la finalización del examen, actualizar la visualización cada segundo, bloquear automáticamente el examen cuando el tiempo llega a cero (timeout), y notificar al candidato cuando queden X minutos restantes (configurable).

**RF-004: Envío de Respuestas** — El sistema debe permitir el envío manual de respuestas antes del timeout, recopilar todas las respuestas contestadas junto con metadatos de tiempo, generar un evento examFinished con la estructura esperada, y'enviar las respuestas a Chaindrenciales mediante POST al endpoint correspondiente.

### 5.2 Requisitos del Sistema de Proctoring

**RF-005: Solicitud de Permisos de Medios** — El sistema debe solicitar permiso de cámara al navegador cuando requireCamera sea verdadero, solicitar permiso de micrófono al navegador cuando requireMicrophone sea verdadero, manejar gracefully los casos en que los permisos son negados por el usuario, y ofrecer instrucciones claras al candidato sobre cómo habilitar los permisos.

**RF-006: Gestión del Consentimiento** — El sistema debe mostrar un diálogo de consentimiento (T&C) antes de iniciar cualquier captura de medios, presentar claramente las políticas de proctoring que incluyen el uso de cámara, micrófono y biometría, registrar la aceptación o rechazo del candidato con timestamp, y bloquear el acceso al examen si el candidato rechaza los términos.

**RF-007: Onboarding Biométrico** — El sistema debe capturar una foto del candidato utilizando la cámara web cuando requireBiometrics sea verdadero, enviar la foto al backend para generar el embedding biométrico de referencia, verificar que la cara sea detectada correctamente en el frame, permitir reintentos en caso de falla de captura, y mostrar feedback visual indicando el estado de la verificación.

**RF-008: Verificación de Entorno** — El sistema debe verificar que las condiciones de iluminación sean adecuadas para la captura de video, verificar que haya una cara visible en el frame de la cámara, opcionalmente detectar objetos sospechosos en el entorno (si la configuración lo permite), y notificar al candidato si el entorno no cumple los requisitos mínimos.

**RF-009: Forzamiento de Pantalla Completa** — El sistema debe solicitar al navegador el ingreso al modo pantalla completa (Fullscreen API) cuando inicie el examen, detectar cuando el candidato sale del modo pantalla completa accidentalmente, registrar una violación FULLSCREEN_EXIT cuando esto ocurra, y предупреди al candidato sobre la importancia de permanecer en pantalla completa.

**RF-010: Detección de Cambios de Pestaña** — El sistema debe detectar cuando el candidato cambia de pestaña en el navegador, detectar cuando el candidato minimiza la ventana del navegador, registrar cada ocurrencia con timestamp preciso, comparar contra el límite máximo de cambios de pestaña (maxTabSwitches), y cancelar el examen si se excede el límite configurado.

**RF-011: Bloqueo de Herramientas de Desarrollo** — El sistema debe detectar la apertura de DevTools (F12 o menú contextual), bloquear o dificultar el acceso a las herramientas del desarrollador, registrar un evento DEVTOOLS_OPENED cuando se detecte intento de acceso, y可选mente cancelar el examen según configuración de seguridad.

**RF-012: Bloqueo de Portapapeles** — El sistema debe detectar intentos de copiar (Ctrl+C), cortar (Ctrl+X), y pegar (Ctrl+V) dentro del área del examen, bloquear estas operaciones para prevenir plagio, y registrar intentos de manipulación del portapapeles.

### 5.3 Requisitos de Captura de Evidencias

**RF-013: Captura de Audio Continua** — El sistema debe grabar audio del micrófono del candidato de manera continua, dividir la grabación en chunks de exactamente 15 segundos, comprimir cada chunk en formato WebM (codec Opus), y enviar cada chunk al backend mediante HTTP POST multipart/form-data de manera asíncrona (fire and forget).

**RF-014: Captura de Snapshots Periódicos** — El sistema debe tomar capturas de video (snapshots) a intervalos regulares configurables (por defecto cada X segundos), convertir el frame a formato JPEG con calidad 0.8, enviar cada snapshot al backend mediante HTTP POST multipart/form-data, y asociar metadatos incluyendo timestamp y correlation_id.

**RF-015: Captura de Snapshots por Evento** — El sistema debe tomar un snapshot adicional inmediatamente cuando se detecte una anomalía (tab switch, pérdida de foco, cara no detectada), marcar el snapshot con el tipo de trigger que lo originó, y'enviar prioritariamente este snapshot al backend.

**RF-016: Registro de Eventos del Navegador** — El sistema debe detectar y registrar eventos lógicos del navegador en tiempo real, enviar cada evento como JSON puro al endpoint de eventos, incluir metadatos completos (correlation_id, exam_id, student_id, timestamp, tipo de evento), y soportar los siguientes tipos de triggers: TAB_SWITCH, FULLSCREEN_EXIT, LOSS_FOCUS, DEVTOOLS_OPENED, NAVIGATION_ATTEMPT, RELOAD_ATTEMPT, CLIPBOARD_ATTEMPT.

### 5.4 Requisitos del Sistema de Resultados

**RF-017: Finalización por Timeout** — El sistema debe detectar cuando el temporizador llega a cero, recopilar automáticamente todas las respuestas seleccionadas, generar el evento de finalización con status "timeout", limpiar los recursos de medios (liberar cámara y micrófono), y enviar los resultados a Chaindrenciales.

**RF-018: Finalización por Submit Manual** — El sistema debe permitir que el candidato envíe el examen voluntariamente antes del timeout, solicitar confirmación antes de enviar si hay preguntas sin responder, recopilar las respuestas y generar el evento de finalización con status "submitted", limpiar los recursos de medios, y enviar los resultados a Chaindrenciales.

**RF-019: Finalización por Violación Crítica** — El sistema debe detectar cuando se alcanza el límite de violaciones permitido, generar el evento de finalización con status "cancelled", incluir un resumen de proctoring con el conteo de violaciones por tipo, limpiar los recursos de medios, y enviar los resultados a Chaindrenciales.

**RF-020: Generación de Resumen de Proctoring** — El sistema debe compilar un resumen que incluya el total de violaciones detectadas por tipo, el timestamp de inicio y fin de sesión, la duración efectiva del examen, el estado del consentimiento y verificación biométrica, y el ID del reporte de SUSIE generado por el backend.

---

## 6. Requisitos No Funcionales

### 6.1 Requisitos de Rendimiento

**RNF-001: Latencia de Captura** — El sistema debe capturar frames de video y audio con una latencia máxima de 100ms desde el momento del evento hasta la disponibilidad en memoria, para garantizar que las evidencias reflejen el estado real del candidato en el momento de la anomalía.

**RNF-002: Tiempo de Carga** — El tiempo total desde que el candidato abre el link del examen hasta que se muestra la primera pantalla de consentimiento no debe exceder los 3 segundos en condiciones de red normales (conexión broadband típica).

**RNF-003: Uso de Memoria** — El consumo de memoria del navegador durante una sesión de examen típica (60 minutos con captura continua) no debe exceder los 500MB, para garantizar compatibilidad con equipos de especificaciones moderadas.

**RNF-004: Envío Asíncrono de Evidencias** — El envío de evidencias no debe bloquear ni afectar la experiencia del candidato durante el examen. Cada operación de envío debe completarse en background sin impactar el rendimiento del examen.

### 6.2 Requisitos de Seguridad

**RNF-005: Protección de Datos Biométricos** — El sistema no debe almacenar imágenes faciales en bruto en ningún storage. Solo se almacenan embeddings (vectores matemáticos) que permiten comparación sin revelar la identidad visual del candidato.

**RNF-006: Integridad de Evidencias** — Todas las evidencias enviadas al backend deben incluir metadatos de correlación (correlation_id, exam_id, student_id, timestamp) que permitan verificar la autenticidad y completitud del registro.

**RNF-007: Comunicación Segura** — Toda la comunicación entre el frontend y el backend debe realizarse mediante HTTPS con TLS 1.2 o superior, y todas las requests deben incluir el token de autenticación proporcionado por Chaindrenciales.

### 6.3 Requisitos de Disponibilidad

**RNF-008: Tolerancia a Fallas de Red** — El sistema debe implementar mecanismos de retry automático con backoff exponencial cuando fallen los envíos de evidencias, almacenar temporalmente las evidencias en IndexedDB del navegador como fallback último, y sincronizar las evidencias pendientes cuando se restablezca la conexión.

**RNF-009: Recuperación de Sesión** — En caso de pérdiddel Connection durante el examen, el sistema debe intentar reconectar automáticamente y continuar la sesión sin pérdida de datos del progreso del candidato.

### 6.4 Requisitos de Compatibilidad

**RNF-010: Compatibilidad de Navegadores** — El sistema debe funcionar correctamente en las últimas versiones estables de Google Chrome, Mozilla Firefox, Microsoft Edge, y Safari. Se debe proporcionar fallback graceful para navegadores que no soporten todas las APIs requeridas.

**RNF-011: APIs de Navegador Requeridas** — El sistema requiere soporte para MediaDevices API (getUserMedia), Fullscreen API, WebSocket (opcional para algunos flujos), IndexedDB, y Web Workers para procesamiento de audio en background.

---

## 7. Casos de Uso

### 7.1 Caso de Uso Principal: Examen Completo con Proctoring

**Descripción:** Un candidato inicia un examen con supervisión completa (cámara, micrófono, biometría, gaze tracking) y lo completa exitosamente.

**Flujo Principal:**

1. El candidato recibe un enlace de Chaindrenciales que contiene el ID de asignación del examen.
2. El candidato abre el enlace en su navegador, lo que carga la librería ngx-susie-proctoring embebida en la aplicación de Chaindrenciales.
3. La librería realiza una llamada GET al endpoint de Chaindrenciales para obtener la configuración del examen (susie-config).
4. Se muestra la pantalla de solicitud de permisos de cámara y micrófono.
5. Una vez concedidos los permisos, se muestra el diálogo de consentimiento con los términos y políticas de proctoring.
6. El candidato lee y acepta los términos, registrando su aceptación.
7. Se inicia el proceso de onboarding biométrico: se captura una foto del candidato y se verifica que sea válida.
8. Opcionalmente, se realiza la verificación del entorno (iluminación, presencia de cara).
9. El candidato confirma el ingreso a pantalla completa.
10. Se inicia el ExamEngine mostrando la primera pregunta y el temporizador.
11. Durante el examen, los servicios de seguridad y evidencias operan en paralelo:
    - SecurityService monitorea cambios de pestaña, DevTools, fullscreen, portapapeles.
    - EvidenceService captura snapshots periódicos y por evento.
    - MediaService graba audio y envía chunks cada 15 segundos.
12. El candidato responde todas las preguntas y hace clic en "Enviar".
13. Se muestra confirmación de envío, se detienen todos los servicios de captura.
14. Se genera el resumen de proctoring y se envía a Chaindrenciales.
15. Se muestra la pantalla de "Examen Completado".

**Flujo Alternativo - Timeout:**

- En el paso 11 o 12, si el temporizador llega a cero, el sistema recolecta automáticamente todas las respuestas y continúa desde el paso 13.

**Flujo Alternativo - Cancelación por Violaciones:**

- En el paso 11, si se alcanza el límite de cambios de pestaña (maxTabSwitches), el sistema genera una violación crítica, cancela el examen, limpia recursos, y envía el resultado con status "cancelled" a Chaindrenciales.

### 7.2 Caso de Uso: Examen Sin Proctoring

**Descripción:** Un candidato inicia un examen básico sin necesidad de supervisión (solo motor de preguntas).

**Diferencias del Flujo Principal:**

1. En el paso 4, no se solicitan permisos de cámara ni micrófono (requireCamera = false, requireMicrophone = false).
2. Se salta el consentimiento (requireConsent = false, derivado de la configuración).
3. Se salta el onboarding biométrico (requireBiometrics = false).
4. Se salta la verificación de entorno.
5. El ExamEngine se inicia directamente sin servicios de seguridad avanzados, aunque se mantiene el temporizador y la navegación de preguntas.

### 7.3 Caso de Uso: Verificación de Resultados de Proctoring

**Descripción:** Un reclutador en Chaindrenciales revisa los resultados de proctoring de un examen marcado como "flagged".

**Flujo Principal:**

1. El reclutador accede al dashboard de Chaindrenciales y visualiza una evaluación con susie_status = "flagged".
2. El reclutador hace clic en "Ver reporte de supervisión".
3. El sistema realiza una llamada GET al endpoint de SUSIE para obtener el reporte general.
4. El reclutador revisa el resumen (total de violaciones, nivel de riesgo).
5. El reclutador accede al timeline de violaciones para ver cronológicamente qué eventos ocurrieron.
6. El reclutador revisa los snapshots capturados, incluyendo el análisis de IA asociado (caras detectadas, objetos, dirección de mirada).
7. Opcionalmente, el reclutador reproduce los clips de audio para verificar si hubo voces adicionales.
8. Basándose en toda la evidencia, el reclutador decide si el examen es válido o debe ser invalidado.

---

## 8. Flujos del Producto

### 8.1 Flujo de Estados del Frontend

El frontend de SUSIE opera mediante una máquina de estados que gestiona el ciclo de vida del examen:

```
[*] --> CHECKING_PERMISSIONS

CHECKING_PERMISSIONS --> CONSENT: Permisos concedidos
CHECKING_PERMISSIONS --> ERROR: Permisos denegados

CONSENT --> BIOMETRIC_CHECK: Acepta T&C + requireBiometrics
CONSENT --> ENVIRONMENT_CHECK: Acepta T&C + requireEnvironmentCheck
CONSENT --> MONITORING: Acepta T&C (sin biometría ni env check)
CONSENT --> BLOCKED: Rechaza T&C

BIOMETRIC_CHECK --> ENVIRONMENT_CHECK: Foto validada + requireEnvCheck
BIOMETRIC_CHECK --> MONITORING: Foto validada (sin env check)
BIOMETRIC_CHECK --> BIOMETRIC_CHECK: Reintento foto

ENVIRONMENT_CHECK --> MONITORING: Entorno OK
ENVIRONMENT_CHECK --> ERROR: Entorno no válido

MONITORING --> EXAM_FINISHED: Submit o timeout
MONITORING --> CANCELLED: Violación crítica
```

### 8.2 Flujo de Datos de Evidencias

```
[Frontend SUSIE] --"HTTP POST (multipart/form-data)"--> [API Gateway Fastify]
                                                              |
                                    +-------------------------+
                                    |                         |
                              [Azure Blob Storage]    [RabbitMQ Event Bus]
                                                              |
                                    +-------------------------+
                                    |           |             |
                              [YOLO Worker] [DeepFace] [Whisper Worker]
                                                              |
                                    +-------------------------+
                                    |                         |
                              [PostgreSQL (metadata)]    [PostgreSQL (resultados IA)]
```

### 8.3 Flujo de Integración con Chaindrenciales

```
[Chaindrenciales Backend] --"GET /evaluaciones/:id/susie-config"--> [Frontend]
                                                                   |
                                                                   v
                                                       [SUSIE Wrapper Component]
                                                                   |
                                      +----------------------------+
                                      |                            |
                              [Captura Evidencias]         [ExamEngine]
                                      |                            |
                                      v                            v
                              [SUSIE Backend]                    |
                                      |                            |
                                      +----------------------------+
                                                                  |
                                                                  v
                                              [POST /evaluaciones/:id/resultados]
                                                                  |
                                                                  v
                                                   [Chaindrenciales Backend]
```

---

## 9. Arquitectura Técnica

### 9.1 Visión General de Arquitectura

SUSIE implementa una arquitectura de microservices orientada a eventos que permite escalar independientemente los componentes según la carga de trabajo. El sistema se divide en tres capas principales: la capa de presentación (librería Angular en el navegador del candidato), la capa de procesamiento (API Gateway y workers de IA), y la capa de almacenamiento (PostgreSQL, Redis, Azure Blob Storage).

La filosofía arquitectónica fundamental es el "Contract First", donde la comunicación entre servicios se rige por contratos JSON estrictos que permiten evolución independiente de los componentes sin romper la compatibilidad.

### 9.2 Componentes de Arquitectura

**9.2.1 Capa de Presentación (Frontend)**

La librería ngx-susie-proctoring es el componente central del frontend. Esta librería Angular se empaqueta como un NPM package que puede ser importado por cualquier aplicación Angular existente, en este caso Chaindrenciales. La librería contiene los siguientes submódulos:

- SusieWrapperComponent: Orchestrator principal que gestiona los estados del examen.
- ConsentDialogComponent: Modal de aceptación de términos y condiciones.
- BiometricOnboardingComponent: Captura y verificación de foto biométrica.
- EnvironmentCheckComponent: Verificación de condiciones de iluminación y presencia facial.
- ExamEngineComponent: Motor de presentación de preguntas y gestión del temporizador.
- SecurityService: Lógica de detección de anomalías y violaciones.
- EvidenceService: Gestión del envío de evidencias al backend.
- MediaService: Abstracción sobre las APIs de medios del navegador.

**9.2.2 Capa de API Gateway**

El API Gateway, implementado en Fastify, actúa como punto único de entrada para todas las evidencias y operaciones síncronas. Sus responsabilidades incluyen la recepción de archivos multimedia (audio, snapshots), validación de formato y tamaño, upload a Azure Blob Storage, publicación de mensajes en RabbitMQ, gestión de sesiones y estado, y respuesta a requests síncronos de biometría.

**9.2.3 Capa de Mensajería**

RabbitMQ funciona como el event bus central del sistema, desacoplando la recepción rápida de evidencias del procesamiento intensivo de IA. El exchange principal "susie.events" distribuye mensajes a colas especializadas: susie.ai.vision para análisis de objetos y caras, susie.ai.audio para transcripción y análisis de voz, y susie.inference para el motor de riesgo final.

**9.2.4 Capa de Inteligencia Artificial**

Los workers de IA consumen mensajes de RabbitMQ y procesan las evidencias de manera asíncrona:

- **YOLO Worker:** Detecta objetos sospechosos en snapshots (celulares, libros, personas adicionales).
- **DeepFace Worker:** Verifica que la persona en cada snapshot sea la misma del onboarding biométrico mediante comparación de embeddings.
- **MediaPipe Worker:** Analiza la dirección de la mirada del candidato para detectar si mira frecuentemente fuera de la pantalla.
- **Whisper Worker:** Transcribe el audio capturado para detectar si el candidato dicta las respuestas o habla con alguien más.

**9.2.5 Capa de Persistencia**

PostgreSQL almacena la información estructurada: sesiones de evaluación, configuraciones de examen, registros de violaciones, resultados de análisis de IA, y metadatos de evidencias. Redis se utiliza para cache de sesiones activas y gestión de estado temporal durante el procesamiento.

Azure Blob Storage almacena los archivos binarios de evidencias: snapshots en formato JPEG, chunks de audio en formato WebM, y la foto biométrica de referencia del candidato.

---

## 10. Modelo de Datos

### 10.1 Entidades Principales

**10.1.1 Tabla: asignacion_examen**

Esta tabla representa la autorización para que un candidato realice un examen específico. Es el punto de partida para cualquier sesión de proctoring.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | bigserial | Identificador único de la asignación |
| usuario_id | bigint | Referencia al candidato |
| examen_id | bigint | Referencia a la definición del examen |
| uuid | varchar | Identificador público/seguro de la asignación |
| fecha_limite | timestamp | Plazo máximo para realizar el examen |
| estado | varchar | Estado general de la asignación |
| susie_report_id | varchar(100) | ID del reporte final generado por SUSIE |

**10.1.2 Tabla: sesion_evaluacion**

Representa un "intento" o ejecución física del examen bajo supervisión de SUSIE. Captura el ciclo de vida completo de la supervisión.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id_sesion | bigint | Identificador único de la sesión activa en SUSIE |
| id_asignacion | bigint | FK hacia asignacion_examen |
| fecha_inicio | timestamp | Poblado por el evento startSession |
| fecha_fin | timestamp | Poblado por el evento endSession |
| estado_sesion | varchar | Estado del intento (IN_PROGRESS, SUBMITTED, CANCELLED) |

**10.1.3 Tabla: infracciones_evaluacion**

Tabla fundamental del motor de proctoring para persistir cada anomalía detectada.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id_infraccion | bigint | Identificador único de la alerta |
| id_sesion | bigint | FK hacia sesion_evaluacion |
| tipo_infraccion | varchar | Identificador estándar (TAB_SWITCH, FULLSCREEN_EXIT, etc.) |
| minuto_infraccion | timestamp | Marca de tiempo de la ocurrencia |
| detalles_infraccion | text | Metadata completa del evento o reporte de IA |
| url_azure_evidencia | varchar | Enlace al archivo multimedia de respaldo |

### 10.2 Relaciones entre Entidades

Las entidades se relacionan mediante las siguientes cardinalidades: una asignacion_examen puede tener múltiples sesion_evaluacion (uno por cada intento), y cada sesion_evaluacion puede tener múltiples infracciones_evaluacion. Esta estructura permite rastrear el historial completo de intentos y sus respectivas violaciones.

---

## 11. Integraciones

### 11.1 Integración con Chaindrenciales

La integración entre SUSIE y Chaindrenciales se realiza mediante un contrato de integración definido que especifica los puntos de conexión entre ambos sistemas.

**11.1.1 Endpoint: GET /api/evaluaciones/:evaluacionId/susie-config**

Chaindrenciales debe proporcionar un endpoint que retorne la configuración completa del examen en el formato esperado por SUSIE. La respuesta debe incluir el sessionContext con examSessionId, examId, examTitle, durationMinutes, y assignmentId. También debe incluir el objeto supervision con los flags de configuración de seguridad (requireCamera, requireMicrophone, requireBiometrics, requireGazeTracking, maxTabSwitches, inactivityTimeoutMinutes). Finalmente, debe incluir el array de preguntas sin las respuestas correctas y las credenciales de API (apiUrl, authToken).

**11.1.2 Endpoint: POST /api/evaluaciones/:evaluacionId/resultados**

SUSIE envía a Chaindrenciales las respuestas del candidato y el resumen de proctoring mediante este endpoint. El payload incluye las respuestas del examen, el status de finalización (submitted, cancelled, timeout), el resumen de proctoring (total de violaciones por tipo), y el susieReportId generado por el backend de SUSIE.

**11.1.3 Endpoint: GET /api/reportes/:reportId (SUSIE)**

Chaindrenciales consulta el reporte de supervisión mediante este endpoint para obtener el resumen general del proctoring.

**11.1.4 Endpoint: GET /api/reportes/:reportId/violations**

Obtiene el timeline completo de violaciones detectadas durante el examen.

**11.1.5 Endpoint: GET /api/reportes/:reportId/snapshots**

Obtiene la lista de snapshots capturados con sus análisis de IA asociados.

### 11.2 Integración con Azure Blob Storage

El backend de SUSIE utiliza Azure Blob Storage para el almacenamiento de archivos binarios de evidencias. La configuración requiere un contenedor específico para evidencias de proctoring, políticas de retención configurables, y generación de URLs SAS (Shared Access Signature) para acceso temporal por parte de Chaindrenciales.

---

## 12. Requisitos de API del Backend de SUSIE

### 12.1 Endpoints Síncronos

**POST /susie/api/v1/monitoreo/sesiones/start**

Inicia una nueva sesión de monitoreo. Request: { examSessionId, examId, userId, timestamp }. Response: { status: "ok", sessionId }.

**POST /susie/api/v1/monitoreo/sesiones/end**

Finaliza una sesión de monitoreo. Request: { examSessionId, status, timestamp }. Response: { status: "ok", susieReportId }.

**POST /susie/api/v1/biometrics/enroll**

Enrola la biométricos del candidato. Request: multipart/form-data con meta y file (foto). Response: { embeddingId, status }.

**POST /susie/api/v1/biometrics/verify**

Verifica la identidad del candidato contra el embedding de referencia. Request: multipart/form-data con correlation_id y file. Response: { verified, similarityScore }.

### 12.2 Endpoints de Evidencias (Fire and Forget)

**POST /susie/api/v1/monitoreo/evidencias/audios**

Envía un chunk de audio. Request: multipart/form-data con meta (JSON), payload_info (JSON), y file (WebM). Response: { status: "ok" }. El campo file debe ser el último en el FormData.

**POST /susie/api/v1/monitoreo/evidencias/snapshots**

Envía un snapshot. Request: multipart/form-data con meta (JSON), payload_info (JSON), y file (JPEG). Response: { status: "ok" }.

**POST /susie/api/v1/monitoreo/evidencias/eventos**

Envía un evento del navegador. Request: application/json con meta y payload conteniendo el tipo de trigger y detalles. Response: { status: "ok" }.

---

## 13. Roadmap y Fases de Desarrollo

### 13.1 Fase 1: Fundamentos del Motor (MVP)

Entregables: Motor de exámenes básico (preguntas, timer, navegación), librería Angular empaquetada como NPM, integración básica con Chaindrenciales, endpoints mínimos del backend.

Criterio de éxito: Un candidato puede completar un examen simple sin proctoring.

### 13.2 Fase 2: Proctoring Básico

Entregables: Captura de cámara y micrófono, diálogo de consentimiento, detección de tab switches, snapshots periódicos, endpoint de evidencias.

Criterio de éxito: Se capturan evidencias durante el examen y se almacenan correctamente.

### 13.3 Fase 3: Inteligencia Artificial

Entregables: Workers de YOLO, DeepFace, MediaPipe, Whisper, cálculo de riesgo probabilístico.

Criterio de éxito: El sistema genera un reporte con análisis de IA por cada evidencia capturada.

### 13.4 Fase 4: Biometría Completa

Entregables: Onboarding biométrico, verificación facial en tiempo real, embedding management.

Criterio de éxito: El sistema verifica la identidad del candidato durante todo el examen.

### 13.5 Fase 5: Dashboard y Consulta

Entregables: Endpoints de consulta de reportes, timeline de violaciones, visor de snapshots, reproductor de audio.

Criterio de éxito: Un reclutador puede revisar completamente un examen desde el dashboard.

---

## 14. Glosario de Términos

| Término | Definición |
|---------|------------|
| SUSIE | Sistema de Supervisión Inteligente de Evaluaciones |
| Proctoring | Supervisión remota de exámenes mediante tecnología |
| Embedding | Representación matemática (vector) de características faciales |
| Chunk | Segmento de audio de duración fija (15 segundos) |
| Snapshot | Captura de un frame de video en formato imagen |
| Correlation ID | Identificador único que agrupa todas las evidencias de una sesión |
| Event Bus | Sistema de mensajería para comunicación asíncrona entre componentes |
| Fire and Forget | Patrón de comunicación donde el emetteur no espera respuesta |

---

## 15. Referencias

- FLUJO_COMPLETO_SUSIE.md — Documentación detallada del flujo de extremo a extremo
- ARCHITECTURE_SUSIE.md — Arquitectura técnica consolidada
- MODELO_DATOS_SUSIE.md — Esquema de base de datos para integración
- CONTRATO_INTEGRACION_BACKEND.md — Especificación de endpoints del backend
- PAYLOAD_EVENTOS_SUSIE.md — Estructura de payloads de eventos y violaciones
- API_SPEC_MODIFICACIONES_CHAINDRENCIALES.md — Modificaciones requeridas en Chaindrenciales
- Contexto_Vielma.md — Contexto del proyecto y responsabilidades del equipo
