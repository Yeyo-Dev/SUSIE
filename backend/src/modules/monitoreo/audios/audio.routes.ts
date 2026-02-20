import { FastifyInstance } from 'fastify';
import fastifyMultipart from '@fastify/multipart';
import { AudioController } from './audio.controller';

export async function audioRoutes(fastify: FastifyInstance) {
    const controller = new AudioController();

    //Registrar este plugin de forma aislada para este contexto
    fastify.register(fastifyMultipart, {
        limits: {
            fileSize: 5 * 1024 * 1024, // Límite de 5MB por fragmento de audio
        }
    });

    // Ruta para subir fragmentos de audio
    fastify.post('/audios', controller.manejadorAudio);
}