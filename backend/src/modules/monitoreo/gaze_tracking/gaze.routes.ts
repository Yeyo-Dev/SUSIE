import { FastifyInstance } from "fastify";
import { GazeController } from "./gaze.controller";

export async function gazeRoutes(fastify: FastifyInstance) {
    const controller = new GazeController();

    //Ruta para recibir datos de seguimiento ocular
    fastify.post('/', controller.recepcionGazeHandler);
}