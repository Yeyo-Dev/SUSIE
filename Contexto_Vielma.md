# CONTEXTO DEL PROYECTO: SUSIE (Sistema de Supervisión Inteligente de Evaluaciones)

## 1. VISIÓN GENERAL
Este proyecto es una Residencia Profesional. El objetivo es desarrollar un módulo de **Proctoring (Supervisión Remota)** llamado SUSIE.
**IMPORTANTE:** SUSIE no es una plataforma independiente. Es un módulo satélite que se integrará en la plataforma educativa "Chaindrenciales".

## 2. MI ROL (USUARIO ACTUAL)
* **Nombre:** Vielma.
* **Rol:** Líder de Frontend y Sensores.
* **Responsabilidad:** Crear la Librería de Angular (`ngx-susie-proctoring`) que captura video, audio y eventos del navegador.
* **Límites:** Yo NO toco la base de datos ni los modelos de IA directamente. Yo solo capturo la evidencia y la envío al **API Gateway**.

## 3. ARQUITECTURA TÉCNICA (MONOREPO)
Estamos trabajando en un Monorepo con la siguiente estructura:
* `/frontend` (MI ÁREA): Angular 17+ Workspace.
    * `projects/ngx-susie-proctoring`: La librería principal.
    * `projects/susie-demo`: App dummy para probar la librería.
* `/backend` (Ramírez): API Gateway en Fastify + RabbitMQ.
* `/ai-engine` (Vargas): Scripts de Python (YOLO, DeepFace).

## 4. INTEGRACIÓN Y FLUJO DE DATOS
La comunicación es asíncrona basada en eventos (Event-Driven).

### A. Inicialización (Input)
Cuando la plataforma Chaindrenciales carga mi librería, me entrega esta configuración (Contrato estricto):
```typescript
interface SusieConfig {
  sessionContext: {
    examSessionId: string; // ID único para trazabilidad (Correlation ID)
    examId: string;
  };
  securityPolicies: {
    requireCamera: boolean;
    requireFullscreen: boolean;
  };
  apiUrl: string; // URL del API Gateway al que debo enviar las fotos
  authToken: string; // JWT del usuario
}
### B. Envío de Evidencia (Output)
Yo capturo snapshots (fotos) o audio y los envío al apiUrl usando FormData. Estructura del JSON que acompaña al archivo:

TypeScript

interface EvidenceMetadata {
  meta: {
    correlation_id: string; // Debe coincidir con examSessionId
    timestamp: string;      // ISO 8601
    source: 'frontend_client_v1';
  };
  payload: {
    type: 'SNAPSHOT' | 'AUDIO_CHUNK' | 'FOCUS_LOST';
    browser_focus: boolean;
  };
}
### 5. FLUJOS FUNCIONALES (DIAGRAMAS TRADUCIDOS A LÓGICA)
Flujo 1: Onboarding Biométrico (Síncrono - Bloqueante)
El usuario entra a la sala de espera.

YO (Front): Solicito permisos de cámara.

YO (Front): Tomo una "Foto de Referencia".

YO (Front): Envío la foto al Backend y muestro un "Spinner" de carga.

Backend: Valida calidad de rostro.

YO (Front): Si recibo "OK", habilito el botón "Comenzar Examen". Si recibo "Error", pido otra foto.

Flujo 2: Monitoreo durante el Examen (Asíncrono - No Bloqueante)
El usuario está contestando el examen.

YO (Front): Cada X segundos (o por evento de sonido/movimiento), capturo un frame oculto en un <canvas>.

YO (Front): Envío el frame al Gateway.

CRÍTICO: NO ESPERO RESPUESTA. El usuario sigue contestando sin interrupciones ("Fire and Forget").

YO (Front): Solo si recibo un evento de WebSocket crítico (ej. "Fraude Confirmado"), muestro una alerta o bloqueo la pantalla.

### 6. REQUERIMIENTOS TÉCNICOS (FRONTEND)
Arquitectura: Usar SusieWrapperComponent como un contenedor padre que usa <ng-content> para envolver el examen.

UI: Usar PrimeNG para modales y alertas.

Cámara: Usar navigator.mediaDevices. Manejar errores si el usuario no tiene cámara.

Estilos: SCSS modular.