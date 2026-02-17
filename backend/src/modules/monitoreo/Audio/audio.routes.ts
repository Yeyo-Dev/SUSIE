import { FastifyInstance } from "fastify";
import { AudioController } from "./audio.controller";

export async function audioRoutes(fastify: FastifyInstance) {
    const controller = new AudioController();

    fastify.get('/audio', {
        websocket: true,
        //Validacion de los datos que llegan en la url
        schema: {
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
    controller.manejadorAudio);
}