import { FastifyInstance } from "fastify";
import { EventoController } from "./evento.controller";

export const eventosRoutes = async (fastify: FastifyInstance) => {
    const eventosController = new EventoController();

    // Ruta para obtener los eventos de una evaluación
    fastify.get('/eventos/:evaluacion_id', eventosController.eventosHandler);
}