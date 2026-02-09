# SUSIE Backend

Este es el backend para el proyecto SUSIE, actuando como API Gateway y productor de eventos. Está construido con Node.js, TypeScript y Fastify.

## Tecnologías

-   **Runtime**: Node.js
-   **Framework**: Fastify
-   **Lenguaje**: TypeScript
-   **Base de Datos**: PostgreSQL (vía Prisma ORM) y Dockerfile personalizado.
-   **Mensajería**: RabbitMQ y Dockerfile personalizado.

## Requisitos Previos

Asegúrate de tener instalado:

-   [Node.js](https://nodejs.org/) (v18 o superior recomendado)
-   [Docker](https://www.docker.com/) y Docker Compose

## Instalación

1.  Clona el repositorio.
2.  Navega a la carpeta del backend:
    ```bash
    cd backend
    ```
3.  Instala las dependencias:
    ```bash
    npm install
    ```

## Configuración y Variables de Entorno

**IMPORTANTE**: Para que Docker funcione correctamente con esta configuración, necesitas un archivo `.env` en la **raíz del proyecto** (un nivel arriba de `backend`) o asegurarte de que las variables de entorno estén disponibles al ejecutar docker-compose.

Variables necesarias (ejemplo):
```env
# Configuración de Base de Datos
DB_USER=admin
DB_PASS=root
DB_NAME=susie_db

# Configuración de RabbitMQ
RABBITMQ_USER=admin
RABBITMQ_PASS=angel02
```

Además, dentro de `backend/.env` necesitas la URL de conexión para Prisma:
```env
DATABASE_URL="postgresql://admin:root@localhost:5433/susie_db?schema=public"
```

## Levantamiento de Servicios (Docker)

El archivo `docker-compose.yml` se encuentra en la **raíz del proyecto** y construye imágenes personalizadas para la base de datos y el broker.

1.  Navega a la raíz del proyecto (donde está `docker-compose.yml`):
    ```bash
    cd ..
    ```
2.  Ejecuta:
    ```bash
    docker-compose up -d --build
    ```
    > Se usa `--build` para asegurar que se construyan las imágenes desde los Dockerfiles en `backend/src/database` y `backend/src/broker`.

Esto levantará:
-   **PostgreSQL**: En el puerto `5433` (interno 5432).
-   **RabbitMQ**: Panel de administración en `http://localhost:15672` y servicio AMQP en el puerto `5672`.

Para detener los servicios:
```bash
docker-compose down
```

## Scripts Disponibles

-   **Desarrollo**:
    ```bash
    npm run dev
    ```
    Inicia el servidor en modo desarrollo.

-   **Producción**:
    ```bash
    npm run build
    npm start
    ```
    Compila y ejecuta la versión de producción.

## Prisma (ORM)

-   **Migraciones y Sincronización**:
    ```bash
    npx prisma migrate dev --name init
    ```
-   **Generar Cliente**:
    ```bash
    npx prisma generate
    ```
-   **Prisma Studio (GUI)**:
    ```bash
    npx prisma studio
    ```
