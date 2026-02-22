# Plan de Trabajo - Vielma (Frontend & Sensores)

Basado en el rol de **Residente 1** en la arquitectura SUSIE.

## Objetivo Principal
Asegurar que los datos salgan del usuario y lleguen a la puerta del servidor (API Gateway).

---

## FASE 1: Cimientos y Conectividad (Semanas 1-4)
**Meta:** Lograr un "Hola Mundo" completo (Dato Frontend -> Backend).

- [x] **Crear proyecto Angular + PrimeNG**
    - Configurar workspace con librería `ngx-susie-proctoring` y demo app (PrimeNG instalado).
- [x] **Implementar RF4 (Consentimiento)**
    - Crear UI para solicitar y gestión de permisos de cámara/micrófono.
- [x] **Captura de Medios**
    - Lograr capturar stream de video y audio usando `navigator.mediaDevices`.
- [x] **Punto de Integración 1**
    - Enviar un JSON de prueba al Gateway de Ramírez (API Fastify).

---

## FASE 2: Desarrollo del Núcleo (Semanas 5-9)
**Meta:** Desarrollo funcional en "caja negra" (Interfaz envía, aunque IA no procese real).

- [x] **Implementar RF1 (Sesión Segura)**
    - Bloqueo de pestañas.
    - Modo Full-screen forzado.
    - Detección de pérdida de foco.
- [x] **Envío de Capturas (Evidencia)**
    - Tomar snapshots (frames) del video.
    - Comprimir imágenes antes del envío.
    - Enviar al Gateway via HTTP/WebSocket.
- [x] **RF2 (Monitoreo Cámara) UI**
    - Mostrar feedback visual al usuario (cámara activa, grabando).

---

## FASE 3: Inteligencia e Inferencia (Semanas 10-13)
**Meta:** Visualización de resultados inteligentes.

- [ ] **Crear Dashboard de Reclutador**
    - Interfaz para ver el estado de los exámenes en curso.
- [ ] **Alertas en Tiempo Real**
    - Implementar WebSockets/Polling para recibir alertas de la IA.
    - Mostrar notificaciones si se detecta fraude.
- [ ] **RF3 (Validación Biométrica UI)**
    - Pantallas para validación de identidad inicial y durante el examen.

---

## FASE 4: Integración Final y Despliegue (Semanas 14-16)
**Meta:** Pulir experiencia y pruebas finales.

- [ ] **Pulir UX/UI**
    - Mejorar manejo de errores (conexión lenta, fallo de cámara).
    - Asegurar experiencia fluida.
- [ ] **Pruebas de Integración (E2E)**
    - Participar en pruebas completas de flujo (Examen -> Detección -> Reporte).

---

## Consejos de Arquitectura para Vielma
1.  **"Dummy" es tu amigo:** No esperar a que la BD esté lista. Enviar datos al Gateway y esperar un "OK 200" simulado.
2.  **Manejo de Archivos:** Enviar imagen al Gateway -> El Gateway sube a Azure y distribuye la URL.
3.  **Comunicación:** Revisar semanalmente la estructura de los JSONs con el equipo.
