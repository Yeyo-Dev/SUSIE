import Fastify, { FastifyInstance } from 'fastify';

export const buildServer = (): FastifyInstance => {
    const server = Fastify({
        logger: true
    });

    server.get('/', async (request, reply) => {
        return { 
            mensaje: "Hola Mundo", 
            estado: "API Gateway Activo", 
        };
    });

    return server;
};