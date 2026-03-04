# CONTEXTO DEL PROYECTO: SUSIE (Sistema de Supervisión Inteligente de Evaluaciones)

## 1. VISIÓN GENERAL
Este proyecto es una Residencia Profesional. El objetivo es desarrollar el módulo **SUSIE**. 
SUSIE no es solo un "overlay", es un **Motor de Exámenes Completo** con Proctoring integrado que reemplaza el evaluador estándar de "Chaindrenciales" cuando se requiere supervisión.

## 2. MI ROL (USUARIO ACTUAL)
* **Nombre:** Vielma.
* **Rol:** Líder de Frontend y Sensores.
* **Responsabilidad:** Construir la Librería de Angular (`ngx-susie-proctoring`), empaquetarla e implementar su orquestación lógica (T&C, Biometría, Motor de Preguntas y Captura).
* **Límites:** Yo NO evalúo las opciones correctas del examen, NO toco base de datos ni analizo fraude con IA. Solo proporciono las respuestas a Chaindrenciales y la evidencia al API Gateway de SUSIE.

## 3. ARQUITECTURA TÉCNICA (MONOREPO)
Estamos trabajando en un Monorepo con la siguiente estructura:
* `/frontend` (MI ÁREA): Angular 17+ Workspace.
    * `projects/ngx-susie-proctoring`: La librería principal (El Producto Real).
    * `projects/susie-demo`: App sandbox para simular cómo Chaindrenciales usará la librería.
* `/backend` (Ramírez): API Gateway en Fastify + colas en RabbitMQ.
* `/ai-engine` (Vargas): Scripts de Python (YOLO, DeepFace, Whisper).

## 4. INTEGRACIÓN Y CONTRATO DE ENTRADA (Librería)
La plataforma Chaindrenciales carga nuestro componente principal (`<susie-wrapper>`) enviándonos toda la lógica del examen:

```typescript
interface SusieExamConfig {
  sessionContext: {
    examSessionId: string; // Correlation ID
    examId: string;
    durationMinutes: number;
  };
  securityPolicies: {
    requireCamera: boolean;
    requireMicrophone: boolean;
    requireBiometrics: boolean;
    preventTabSwitch: boolean;
    // ...
  };
  questions: SusieQuestion[]; // Las preguntas del examen (SIN la respuesta correcta)
  apiUrl: string; // URL del API Gateway de SUSIE
  authToken: string; // JWT
}
```

## 5. FLUJOS FUNCIONALES Y CAPTURA DE EVIDENCIA
El envío de evidencia se hace de manera **Asíncrona (Fire and Forget)** por medio de **HTTP POST (`multipart/form-data`)**. **El campo `file` en los formData debe ir al final obligatoriamente.**

### A. Audio Chunks
- Se graba el micrófono constantemente.
- **Cada 15 segundos** se comprime un chunk de audio (`.webm`) y se envía al API Gateway. (15s es requerido para que la IA Whisper sea precisa al detectar habla continua).

### B. Envío de Evidencia (Output / Fire & Forget)
El envío de evidencia se hace de manera **Asíncrona (Fire and Forget)** por medio de **HTTP POST (`multipart/form-data` o `application/json`)**. **El campo `file` en los formData debe ir al final obligatoriamente.**

1. **Audio Chunks:** Cada 15 segundos se comprime un chunk de audio (`.webm`) y se envía vía FormData. (15s es requerido para que la IA Whisper sea precisa).
2. **Snapshots Periódicos:** Cada X segundos (o en anomalías), tomo una foto del video oculto en un `<canvas>` y la envío (`.jpeg`) vía FormData.
3. **Eventos Lógicos (Navegador):** Al detectar cambios de pestaña (Tab Switch), pérdida de foco o click derecho, se envía un JSON puro reportando el trigger y duración al motor de inferencia.

*Nota: La IA del backend (Motor Probabilístico) utiliza la correlación de estos 3 tipos de datos para determinar si el usuario comete fraude, por lo que su envío constante es crítico.*

## 6. REQUERIMIENTOS TÉCNICOS (FRONTEND)
1.  **Arquitectura por Capas Condicionales:** Las interfaces de Consentimiento (T&C) y Onboarding Biométrico solo se muestran si el `SusieExamConfig` lo requiere, si no, salta al `ExamEngine`.
2.  **Seguridad Base:** Forzar Full-screen, bloqueo de click derecho/DevTools y detección de foco de pestaña (Tab Switch).
3.  **App Serverless:** `ngx-susie-proctoring` vive y muere en el navegador del alumno, embebida en Chaindrenciales. No hay "servidor SUSIE de Frontend".
4.  **Entrega Final:** Al vencer el `durationMinutes` o darle en Enviar, yo colecciono las `answers` escogidas y el `proctoring_summary` y emito el evento `(examFinished)` hacia Chaindrenciales para que ellos guarden y evalúen.