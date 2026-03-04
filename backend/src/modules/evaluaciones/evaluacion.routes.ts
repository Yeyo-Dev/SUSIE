import {FastifyInstance} from "fastify";
import { EvaluacionController } from "./evaluacion.controller";

export const evaluacionRoutes = async (fastify: FastifyInstance) => {
    const evaluacionController = new EvaluacionController();//Instancia del controlador

    //Ruta para obtener la configuración de una evaluación
    fastify.get('/configuracion/:id_configuracion', evaluacionController.obtenerConfiguracion);
}