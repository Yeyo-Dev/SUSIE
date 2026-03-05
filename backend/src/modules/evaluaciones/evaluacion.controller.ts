import { FastifyRequest, FastifyReply } from 'fastify';
import { EvaluacionService } from './evaluacion.service';

export class EvaluacionController {
    
    private evaluacionService: EvaluacionService;

    constructor() {
        this.evaluacionService = new EvaluacionService();//Instancia del servicio
    }

obtenerConfiguracion = async (req: FastifyRequest, reply: FastifyReply) => {
        try {
            // Recibimos evaluacion_id de los parámetros de la URL
            const idParam = (req.params as any).evaluacion_id;
            
            if (!idParam || isNaN(Number(idParam))) {
                return reply.code(400).send({
                    success: false,
                    message: "El ID de evaluación proporcionado no es válido."
                });
            }

            const evaluacionIdBigInt = BigInt(idParam);

            // Llamada al servicio
            const configSusie = await this.evaluacionService.obtenerConfiguracionExamen(evaluacionIdBigInt);

            if (!configSusie) {
                return reply.code(404).send({
                    success: false,
                    message: `No se encontró información para la evaluación ${idParam}`
                });
            }
            //Retorna la configuración de la evaluación
            return reply.code(200).send({
                success: true,
                evaluacion: configSusie
            });

        } catch (error) {
            req.log.error(error);
            return reply.code(500).send({
                success: false,
                message: "Ocurrió un error interno al obtener la configuración."
            });
        }
    }
}