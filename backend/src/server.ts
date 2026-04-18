import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import rabbitMQConnector from './config/rabbitmq';
import redisPlugin from './config/redis';
import { ProducerService } from './broker/producer.service';
import { ConsumerService } from './broker/consumer.service';
import { userRoutes } from './modules/usuarios/user.routes';
import { evaluacionRoutes } from './modules/evaluaciones/evaluacion.routes';
import { examenRoutes } from './modules/examenes/examen.routes';
import { biometricoRoutes } from './modules/usuarios/biometricos/biometrico.routes';
import { sesionEvaluacionRoutes } from './modules/sesiones_evaluacion/sesion.routes';
import { snapshotRoutes } from './modules/monitoreo/snapshots/snapshot.routes';
import { audioRoutes } from './modules/monitoreo/audios/audio.routes';
import { infraccionRoutes } from './modules/monitoreo/infracciones/infraccion.routes';
import { eventosRoutes } from './modules/monitoreo/eventos/eventosroutes';
import websocket from '@fastify/websocket';

export let broker: ProducerService; // Variable global para acceder al broker

export const buildServer = (): FastifyInstance => {
    const server = Fastify({
        logger: true
    });

    server.register(cors, {
        origin: true,
    });
    
    // Sobrescribe el método toJSON de BigInt para evitar errores de serialización
    (BigInt.prototype as any).toJSON = function () {
        return this.toString();
    };

    const prefixApi = '/susie/api/v1';

    // ── Infraestructura ──────────────────────────────────────
    server.register(rabbitMQConnector);
    server.register(redisPlugin);
    server.register(websocket);

    // ── Rutas ────────────────────────────────────────────────
    // Evaluaciones
    server.register(evaluacionRoutes, { prefix: prefixApi + '/evaluaciones' });
    // Exámenes
    server.register(examenRoutes, { prefix: prefixApi + '/examenes' });
    // Usuarios
    server.register(userRoutes, { prefix: prefixApi + '/usuarios' });
    server.register(biometricoRoutes, { prefix: prefixApi + '/usuarios/biometricos' });
    // Sesiones de evaluación
    server.register(sesionEvaluacionRoutes, { prefix: prefixApi + '/sesiones' });
    // Monitoreo — Evidencias
    server.register(snapshotRoutes, { prefix: prefixApi + '/monitoreo/evidencias' });
    server.register(audioRoutes, { prefix: prefixApi + '/monitoreo/evidencias' });
    // Monitoreo — Eventos del navegador
    server.register(eventosRoutes, { prefix: prefixApi + '/monitoreo/evidencias' });
    // Monitoreo — Infracciones
    server.register(infraccionRoutes, { prefix: prefixApi + '/monitoreo/infracciones' });

    // ── Inicialización post-arranque ─────────────────────────
    server.ready().then(async () => {
        // Inicializar Producer (publicar mensajes a RabbitMQ)
        broker = new ProducerService(server);
        server.log.info('ProducerService inicializado.');

        // Inicializar Consumer (escuchar q_infracciones)
        const consumer = new ConsumerService(server);
        await consumer.iniciarConsumo();
        server.log.info('ConsumerService inicializado — escuchando q_infracciones.');
    });

    // ── Health check ─────────────────────────────────────────
    server.get(prefixApi, async (request, reply) => {
        return {
            mensaje: "Hola Mundo",
            estado: "API Gateway SUSIE Activo",
        };
    });

    return server;
};