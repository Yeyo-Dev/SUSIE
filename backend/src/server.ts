import Fastify, { FastifyInstance } from 'fastify';
import rabbitMQConnector from './config/rabbitmq';
import redisPlugin from './config/redis';
import { ProducerService } from './broker/producer.service';
import { userRoutes } from './modules/user/user.routes';
import { videoRoutes } from './modules/monitoreo/video/video.routes';
import { audioRoutes } from './modules/monitoreo/Audio/audio.routes';
import websocket from '@fastify/websocket';

export let broker: ProducerService; //Variable global para acceder al broker

export const buildServer = (): FastifyInstance => {
    const server = Fastify({
        logger: {
            transport: {
                target: 'pino-pretty',
                options: {
                    translateTime: 'HH:MM:ss Z',
                    ignore: 'pid,hostname',
                },
            },
        },
    });

    server.register(rabbitMQConnector); //conexion a rabbitMQ
    server.register(redisPlugin); //conexion a redis
    server.register(websocket);
    server.register(userRoutes, { prefix: '/api' });
    server.register(videoRoutes, { prefix: '/api/monitoreo' });
    server.register(audioRoutes, { prefix: '/api/monitoreo' });

    server.ready().then(() => {
        broker = new ProducerService(server); //Inicializamos el broker
        server.log.info('ProducerService inicializado y listo para usar.');
    });

    server.get('/', async (request, reply) => {
        return {
            mensaje: "Hola Mundo",
            estado: "API Gateway Activo",
        };
    });

    return server;
};