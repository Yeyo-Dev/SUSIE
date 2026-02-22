# Plan de Trabajo - Vielma (Frontend & Sensores)

Basado en el rol de **Residente 1** en la arquitectura SUSIE.

## Objetivo Principal
Construir y empaquetar **`ngx-susie-proctoring`** (la librería de Angular) para que Chaindrenciales pueda embeber el motor de exámenes completo en su plataforma, y asegurar que la evidencia se capture y envíe asíncronamente al API Gateway.

---

## FASE 1: Cimientos y Conectividad (Completada & Refactorizada)
**Meta:** Establecer la librería base y lograr comunicación REST con el Backend.

- [x] **Crear proyecto Monorepo Angular**
    - Configurar workspace con librería `ngx-susie-proctoring` separada de la demo app `susie-demo`.
- [x] **Solicitud de Permisos (Browser)**
    - Obtener permisos de cámara y micrófono vía `navigator.mediaDevices`.
- [x] **Punto de Integración 1**
    - Establecer comunicación HTTP inicial con el Gateway de Ramírez.

---

## FASE 2: Desarrollo del Motor de Exámenes (Librería)
**Meta:** Convertir la librería en el orquestador principal del examen, asumiendo el control desde que Chaindrenciales "suelta" al candidato.

- [ ] **Orquestador Principal (`SusieWrapperComponent`)**
    - Recibir el objeto de configuración (`SusieExamConfig`) de Chaindrenciales.
    - Manejar la lógica condicional de capas (Mostrar cámara/micro solo si se requiere en el config).
- [ ] **Capa 1: Consentimiento (T&C)**
    - Implementar componente `ConsentDialog` para mostrar términos antes del arranque.
- [ ] **Capa 3: Motor de Examen (`ExamEngine`)**
    - Migrar/construir la UI del timer (cuenta regresiva).
    - Renderizar las preguntas recibidas en la configuración e iterar la paginación.
    - Capturar las respuestas seleccionadas por el candidato.
- [ ] **Fin del Examen y Entregables**
    - Emitir evento `(examFinished)` hacia Chaindrenciales al agotar el tiempo o enviar.
    - Empaquetar el payload con el objeto `answers` y el `proctoring summary` de la sesión.

---

## FASE 3: Captura de Evidencias y Seguridad (Proctoring Real)
**Meta:** Cumplir el "Contrato de Integración Backend" enviando las anomalías y multimedia.

- [x] **Implementar RF1 (Sesión Segura)**
    - Bloqueo total: Impedir Click Derecho (Context Menu), detectar cambio de pestañas y forzar Full-screen.
- [ ] **Migración a HTTP POST (FormData)**
    - **Audio:** Enviar chunks de audio cada **15 segundos** usando `multipart/form-data` al endpoint de evidencias.
    - **Video/Snapshots:** Enviar snapshots de la cámara usando el mismo método al endpoint respectivo.
    - *Asegurar poner el campo del archivo al final del formData en ambos casos.*
- [ ] **Inactividad y Trazabilidad**
    - Servicio para alertar al candidato y reportar inactividad prolongada de mouse/teclado.
    - Mantener el `correlation_id` o `examSessionId` adjunto en toda evidencia enviada.

---

## FASE 4: Onboarding Biométrico e Integración Final
**Meta:** Pulir la experiencia de enrolamiento e implementar integraciones end-to-end.

- [ ] **RF3 (Validación Biométrica UI)**
    - Crear `BiometricOnboarding` para capturar la foto de referencia inicial antes de comenzar el examen.
- [ ] **Pulir UX/UI**
    - Retroalimentación clara si la red de subida está fallando o la cámara se desconectó.
- [ ] **Pruebas de Integración (E2E)**
    - Simular en `susie-demo` lo que haría Chaindrenciales (enviar mock configs y escuchar el fin del examen).

---

## Consejos de Arquitectura para Vielma
1.  **Chaindrenciales manda, SUSIE obedece:** Si en el `config` te llega `requireCamera: false`, debes saltar todas las fases visuales de captura y llevar al alumno directo a las preguntas.
2.  **Fire & Forget en Evidencias:** Envía los snapshots y pedazos de audio al backend (Fastify) y **no esperes a que IA termine** de analizar para que el alumno avance. Todo es asíncrono.
3.  **No evalúes respuestas:** Tu librería no sabe las respuestas correctas; tu misión es recolectar lo que el usuario escogió y entregárselo a Chaindrenciales íntegro al final del examen.
