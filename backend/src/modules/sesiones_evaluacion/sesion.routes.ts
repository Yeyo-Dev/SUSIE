import { FastifyInstance } from "fastify";
import { SesionEvaluacionController } from "./sesion.controller";   

export async function sesionEvaluacionRoutes(fastify: FastifyInstance) {
    const controller = new SesionEvaluacionController();    

    //Ruta para iniciar una sesión de evaluación, se espera un body con el id_asignacion.
    fastify.post('/', controller.IniciarSesionEvaluacionHandler);

    //Ruta para finalizar una sesión de evaluación, se espera el id_sesion como parámetro en la URL.
    fastify.patch('/finalizar/:id_sesion', controller.FinalizarSesionEvaluacionHandler);
}