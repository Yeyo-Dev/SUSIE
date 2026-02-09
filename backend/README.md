# SUSIE Backend

Este es el backend para el proyecto SUSIE, actuando como API Gateway y productor de eventos. Está construido con Node.js, TypeScript y Fastify.

## Tecnologías

-   **Runtime**: Node.js
-   **Framework**: Fastify
-   **Lenguaje**: TypeScript
-   **Base de Datos**: PostgreSQL (vía Prisma ORM)
-   **Mensajería**: RabbitMQ

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

Crea un archivo `.env` en la raíz de la carpeta `backend` con las siguientes variables. Asegúrate de que coincidan con tu configuración deseada:

```env
# Configuración de Base de Datos
DB_USER=admin
DB_PASS=root
DB_NAME=susie_db
DATABASE_URL="postgresql://admin:root@localhost:5433/susie_db?schema=public"

# Configuración de RabbitMQ
RABBITMQ_USER=admin
RABBITMQ_PASS=angel02
```

> **Nota**: El puerto de la base de datos en `DATABASE_URL` debe coincidir con el expuesto en `docker-compose.yml` (por defecto `5433`).

## Levantamiento de Servicios (Docker)

El proyecto incluye un archivo `docker-compose.yml` para levantar PostgreSQL y RabbitMQ fácilmente.

1.  Asegúrate de tener el archivo `.env` configurado, ya que Docker Compose lo utiliza.
2.  Ejecuta el siguiente comando en la carpeta `backend`:
    ```bash
    docker-compose up -d
    ```

Esto levantará:
-   **PostgreSQL**: En el puerto `5433` (interno 5432).
-   **RabbitMQ**: Panel de administración en `http://localhost:15672` (usuario/pass definidos en .env) y servicio AMQP en el puerto `5672`.

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
