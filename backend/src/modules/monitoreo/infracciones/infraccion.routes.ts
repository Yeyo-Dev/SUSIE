import { FastifyInstance } from "fastify";
import { InfraccionController } from "./infraccion.controller";

export async function infraccionRoutes(fastify: FastifyInstance) {
    const controller = new InfraccionController();//

    fastify.post('/', controller.createHandler);
}