import { FastifyInstance } from 'fastify';
import fastifyMultipart from '@fastify/multipart';
import { SnapshotController } from './snapshots.controller';

export async function snapshotsRoutes(fastify: FastifyInstance) {
    const controller = new SnapshotController();

    //Registrar el plugin para manejar archivos
    fastify.register(fastifyMultipart, {
        limits: {
            fileSize: 10 * 1024 * 1024, // Límite de 10MB por snapshot
        }
    });

   //Ruta para subir snapshots
    fastify.post('/snapshots/upload', controller.manejadorSnapshot);
}