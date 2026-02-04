# SUSIE (Sistema de Supervisión Inteligente de Evaluaciones)

SUSIE es un sistema de proctoring inteligente diseñado para la supervisión de evaluaciones académicas. Este proyecto está estructurado como un monorepo basado en microservicios y arquitectura orientada a eventos.

## Estructura del Proyecto

El proyecto se divide en tres componentes principales:

1.  **Frontend (`/frontend`)**:
    *   Desarrollado en **Angular 17+**.
    *   Contiene una librería `ngx-susie-proctoring` con la lógica de supervisión.
    *   Incluye una aplicación `susie-demo` para pruebas e integración.
2.  **Backend (`/backend`)**:
    *   API Gateway y orquestador de eventos.
    *   Desarrollado en **Node.js** con **Fastify** y **TypeScript**.
3.  **AI Engine (`/ai-engine`)**:
    *   Motor de inteligencia artificial para análisis de comportamiento.
    *   Desarrollado en **Python 3.10+**.
    *   Consume mensajes de RabbitMQ para procesamiento asíncrono.

## Infraestructura

La infraestructura local se gestiona mediante Docker Compose e incluye:

*   **RabbitMQ**: Message Broker para la comunicación asíncrona entre servicios.
*   **PostgreSQL**: Base de datos relacional principal.
*   **Redis**: Caché y gestión de sesiones.

## Requisitos Previos

*   Docker y Docker Compose
*   Node.js (v18+ recomendado)
*   Python 3.10+
*   Angular CLI

## Configuración Inicial

1.  **Levantar infraestructura**:
    ```bash
    docker-compose up -d
    ```

2.  **Instalar dependencias**:
    *   Frontend: `cd frontend && npm install`
    *   Backend: `cd backend && npm install`
    *   AI Engine: `cd ai-engine && pip install -r requirements.txt`

## Desarrollo

Consulte el `README.md` específico de cada subdirectorio para instrucciones detalladas de desarrollo y ejecución de cada servicio.
