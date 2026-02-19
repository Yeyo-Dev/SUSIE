import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
//import rabbitMQConnector from './config/rabbitmq';
//import redisPlugin from './config/redis';
import { ProducerService } from './broker/producer.service';
import { userRoutes } from './modules/user/user.routes';
import {snapshotRoutes} from './modules/monitoreo/snapshots/snapshot.routes';
import {audioRoutes} from './modules/monitoreo/audios/audio.routes';
import websocket from '@fastify/websocket';

export let broker: ProducerService; //Variable global para acceder al broker

export const buildServer = (): FastifyInstance => {
    const server = Fastify({
        logger: true
    });

    server.register(cors, {//permite la comunicacion entre el frontend y el backend
        origin: true,
    });

    const prefixApi = '/susie/api/v1';

    //server.register(rabbitMQConnector); //conexion a rabbitMQ
    //server.register(redisPlugin); //conexion a redis
    server.register(websocket);
    server.register(userRoutes, { prefix: prefixApi + '/user' });
    server.register(snapshotRoutes, { prefix: prefixApi + '/monitoreo/evidencias' });
    server.register(audioRoutes, { prefix: prefixApi + '/monitoreo/evidencias' });

    server.ready().then(() => {
        broker = new ProducerService(server); //Inicializamos el broker
        server.log.info('ProducerService inicializado y listo para usar.');
    });

    server.get(prefixApi, async (request, reply) => {
        return {
            mensaje: "Hola Mundo",
            estado: "API Gateway SUSIE Activo",
        };
    });

    return server;
};