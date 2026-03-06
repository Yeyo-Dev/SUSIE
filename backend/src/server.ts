import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import rabbitMQConnector from './config/rabbitmq';
//import redisPlugin from './config/redis';
import { ProducerService } from './broker/producer.service';
import { userRoutes } from './modules/usuarios/user.routes';
import { evaluacionRoutes } from './modules/evaluaciones/evaluacion.routes';
import { examenRoutes } from './modules/examenes/examen.routes';
import { biometricoRoutes } from './modules/usuarios/biometricos/biometrico.routes';
import { sesionEvaluacionRoutes } from './modules/sesiones_evaluacion/sesion.routes';
import {snapshotRoutes} from './modules/monitoreo/snapshots/snapshot.routes';
import {audioRoutes} from './modules/monitoreo/audios/audio.routes';
import {gazeRoutes} from './modules/monitoreo/gaze_tracking/gaze.routes';
import { infraccionRoutes } from './modules/monitoreo/infracciones/infraccion.routes';
import websocket from '@fastify/websocket';

export let broker: ProducerService; //Variable global para acceder al broker

export const buildServer = (): FastifyInstance => {
    const server = Fastify({
        logger: true
    });

    server.register(cors, {//permite la comunicacion entre el frontend y el backend
        origin: true,
    });
    
    // Sobrescribe  el metodo toJSON de BigInt para evitar errores de serialización al devolver objetos que contienen BigInt en las respuestas JSON.
    (BigInt.prototype as any).toJSON = function () {
        return this.toString();
    };

    const prefixApi = '/susie/api/v1';

    server.register(rabbitMQConnector); //conexion a rabbitMQ
    //server.register(redisPlugin); //conexion a redis
    server.register(websocket);
    //RUTAS PARA EVALUACIONES
    server.register(evaluacionRoutes, { prefix: prefixApi + '/evaluaciones' });
    //RUTAS PARA EXAMENES
    server.register(examenRoutes, { prefix: prefixApi + '/examenes' });
    //RUTAS PARA USUARIOS
    server.register(userRoutes, { prefix: prefixApi + '/usuarios' });
    server.register(biometricoRoutes, { prefix: prefixApi + '/usuarios/biometricos' });
    //RUTAS PARA SESIONES DE EVALUACION
    server.register(sesionEvaluacionRoutes, { prefix: prefixApi + '/sesiones' });
    //RUTAS PARA MONITOREO
    server.register(snapshotRoutes, { prefix: prefixApi + '/monitoreo/evidencias' });
    server.register(audioRoutes, { prefix: prefixApi + '/monitoreo/evidencias' });
    server.register(gazeRoutes, { prefix: prefixApi + '/monitoreo/evidencias/gaze_tracking' });
    //RUTAS PARA INFRACCIONES
    server.register(infraccionRoutes, { prefix: prefixApi + '/monitoreo/infracciones' });

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