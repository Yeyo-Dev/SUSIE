import { FastifyInstance } from "fastify";
import { ExamenController } from "./examen.controller";

export async function examenRoutes(fastify: FastifyInstance) {
    const controller = new ExamenController();//Instanciamos el controlador

    //Obtener un examen específico con sus preguntas
    fastify.get('/:examen_id', controller.obtenerExamenHandler);
}