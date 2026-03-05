import {FastifyInstance} from "fastify";
import { EvaluacionController } from "./evaluacion.controller";

export const evaluacionRoutes = async (fastify: FastifyInstance) => {
    const evaluacionController = new EvaluacionController();//Instancia del controlador

    //Ruta para obtener la configuración de una evaluación
    fastify.get('/configuracion/:evaluacion_id', evaluacionController.obtenerConfiguracion);
}