---
name: Backend Microservices Architecture
description: Guidelines for Node.js microservices using Fastify and RabbitMQ.
---

# Backend Microservices Best Practices

## 1. Principles
-   **Service Boundaries:** One service, one responsibility. No distributed monoliths.
-   **Async Communication:** Use RabbitMQ for inter-service communication (Event-Driven).
-   **Validation:** Strict Input/Output validation using JSON Schema (Fastify standard).

## 2. Fastify Patterns
-   **Plugins:** Everything is a plugin (`fastify-plugin`). Split logic into small, reusable plugins.
-   **Decorators:** Use `fastify.decorate()` to expose shared utilities or database connections.
-   **Serialization:** Pre-compile schemas for response serialization (`fastify-type-provider-zod` or standard JSON Schema).
-   **Logging:** Use `pino` (built-in). Log structured JSON.

## 3. RabbitMQ Patterns
-   **Resilience:** Handle connection loss. Use retry queues or dead-letter exchanges (DLX) for failed messages.
-   **Idempotency:** Consumers must be idempotent. Processing the same message twice should not corrupt state.
-   **Prefetch:** Set `channel.prefetch(1)` to process messages one by one if the task is heavy.

## 4. Project Structure
```
src/
  plugins/    # Shared logic (DB, Auth, MQ)
  routes/     # API Endpoints
  services/   # Business Logic
  schemas/    # JSON Schemas (Zod/Fluent)
  app.ts      # App Factory
  server.ts   # Entry Point
```
