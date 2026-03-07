import { FastifyInstance } from "fastify";
import { EventoController } from "./evento.controller";

export const eventosRoutes = async (fastify: FastifyInstance) => {
    const eventosController = new EventoController();

    // Ruta POST para registrar un nuevo evento del navegador
    fastify.post('/', eventosController.registrarEventoHandler);
}