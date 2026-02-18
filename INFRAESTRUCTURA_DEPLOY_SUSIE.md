# 🌐 Infraestructura y Deploy de SUSIE — ¿Dónde vive cada pieza?

> **Fecha:** 16 de Febrero de 2026
> **Propósito:** Aclarar cómo se despliega SUSIE y cómo se conecta con Chaindrenciales

---

## 1. La librería vive en el NAVEGADOR del candidato

`ngx-susie-proctoring` es un paquete npm. Cuando Chaindrenciales hace `npm install ngx-susie-proctoring`, el código de SUSIE **se empaqueta dentro de la app de Chaindrenciales**. No hay un "servidor de SUSIE frontend" separado — la librería corre directamente en el navegador del usuario como parte de la app de Chaindrenciales.

```
Chaindrenciales (Angular app)
├── node_modules/
│   └── ngx-susie-proctoring/    ← La librería, empaquetada aquí
├── src/
│   └── app/
│       └── exam/
│           └── exam.component.ts  ← usa <susie-wrapper>
```

---

## 2. El resto de SUSIE → Servidor(es) separado(s)

El backend de SUSIE (Fastify, DeepFace workers, RabbitMQ) **sí vive en otro servidor**. La conexión es por HTTP via la propiedad `apiUrl` del config:

```
┌─────────────────────────────────────────────────┐
│  NAVEGADOR DEL CANDIDATO                         │
│                                                   │
│  Chaindrenciales App (Angular)                    │
│   └── ngx-susie-proctoring (librería embebida)   │
│       └── apiUrl: "https://susie-api.dominio.com" ──────┐
│       └── authToken: "JWT..."                     │      │
└───────────────────────────────────────────────────┘      │
                                                           │ HTTPS
┌───────────────────────────────────────────────────┐      │
│  SERVIDOR CHAINDRENCIALES                          │      │
│  (Spring Boot / su backend actual)                 │      │
│  - Crear exámenes, asignar, evaluar               │      │
│  - Base de datos de Chaindrenciales                │      │
└───────────────────────────────────────────────────┘      │
                                                           │
┌───────────────────────────────────────────────────┐      │
│  SERVIDOR SUSIE (infraestructura propia)           │ ◄────┘
│                                                    │
│  ┌──────────────┐  ┌───────────┐  ┌────────────┐ │
│  │ API Gateway   │  │ RabbitMQ  │  │ PostgreSQL │ │
│  │ (Fastify)     │──│           │  │ (SUSIE DB) │ │
│  │ :8000         │  │ :5672     │  │ :5432      │ │
│  └──────┬───────┘  └─────┬─────┘  └────────────┘ │
│         │                │                         │
│  ┌──────┴───────┐  ┌─────┴─────────────────────┐ │
│  │ DeepFace     │  │ AI Workers                 │ │
│  │ Worker       │  │ (YOLO, Whisper, MediaPipe) │ │
│  │ (síncrono)   │  │ (consumen de RabbitMQ)     │ │
│  └──────────────┘  └───────────────────────────┘ │
│                                                    │
│  ┌──────────────┐  ┌────────────┐                 │
│  │ Redis        │  │ Azure Blob │                 │
│  │ (caché)      │  │ (archivos) │                 │
│  └──────────────┘  └────────────┘                 │
└───────────────────────────────────────────────────┘
```

---

## 3. Los 3 "lugares" distintos

| Dónde | Qué | Quién lo controla |
|-------|-----|-------------------|
| **Navegador** | `ngx-susie-proctoring` (librería Angular) | Vielma — se empaqueta con Chaindrenciales |
| **Servidor Chaindrenciales** | Backend de exámenes (Spring Boot), crear/asignar/evaluar | Equipo Chaindrenciales |
| **Servidor SUSIE** | API Gateway + AI Workers + DB + RabbitMQ + Azure | Ramírez + Vargas |

---

## 4. ¿Cómo "llama" la librería al servidor SUSIE?

A través de la `apiUrl` que Chaindrenciales configura. Es HTTP puro:

```typescript
// Chaindrenciales configura esto al crear el componente:
const examConfig: SusieExamConfig = {
  apiUrl: 'https://susie-api.midominio.com',  // ← servidor SUSIE
  authToken: 'eyJhbGciOi...',                 // ← JWT del candidato
  // ... preguntas, seguridad, etc.
};
```

```html
<susie-wrapper [config]="examConfig" />
```

Internamente, la librería usa `HttpClient` para enviar evidencia, enrollar biométricos, y verificar identidad — todo hacia esa `apiUrl`.

---

## 5. Deploy con Docker Compose

En Docker Compose o Kubernetes sería algo así:

```yaml
# Servidor SUSIE (docker-compose.yml)
services:
  api-gateway:        # Fastify - Puerto 8000
  deepface-worker:    # Python - Biometría síncrona
  ai-workers:         # Python - YOLO, Whisper (async vía RabbitMQ)
  rabbitmq:           # Cola de mensajes
  postgres:           # DB de SUSIE (sesiones, biométricos, logs)
  redis:              # Caché
```

Chaindrenciales solo necesita saber la URL del `api-gateway`. Todo lo demás (RabbitMQ, workers, DB) es **interno** de SUSIE y Chaindrenciales nunca los toca directamente.

---

## 6. Analogía

Piénsalo como **Google Maps**:

| Google Maps | SUSIE |
|-------------|-------|
| Google Maps SDK (JavaScript) → se instala en tu app web | `ngx-susie-proctoring` → se instala en Chaindrenciales |
| Servidores de Google Maps → procesan todo en la nube | Servidor SUSIE → API Gateway + IA + DB |
| Tu app → solo usa el SDK y le pasa una API key | Chaindrenciales → solo usa la librería y le pasa `apiUrl` + `authToken` |

---

## 7. Documentos relacionados

- [Arquitectura SUSIE — Motor Completo](./ARQUITECTURA_SUSIE_MOTOR_EXAMENES.md)
- [Flujo Biométricos](./FLUJO_BIOMETRICOS.md)
