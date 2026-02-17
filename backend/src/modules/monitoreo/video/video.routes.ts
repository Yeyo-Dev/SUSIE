import { FastifyInstance } from "fastify";
import { VideoController } from "./video.controller";

export async function videoRoutes(fastify: FastifyInstance) {
    const controller = new VideoController();
    fastify.get('/video', {
        websocket: true,
        schema: {//Validacion de los datos que llegan por la url
            querystring: {
                type: 'object',
                properties: {
                    id_usuario: { type: 'number' },
                    nombre_usuario: { type: 'string' },
                    nombre_examen: { type: 'string' }
                },
                required: ['id_usuario', 'nombre_usuario', 'nombre_examen']
            }
        }
    },
    controller.manejadorVideo);
}