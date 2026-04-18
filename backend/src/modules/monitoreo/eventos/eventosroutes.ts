import { FastifyInstance } from "fastify";
import { EventoController } from "./evento.controller";

export const eventosRoutes = async (fastify: FastifyInstance) => {
    const eventosController = new EventoController();

    // POST — Recibir eventos del navegador desde el frontend
    fastify.post('/eventos', eventosController.crearEventoHandler);
};