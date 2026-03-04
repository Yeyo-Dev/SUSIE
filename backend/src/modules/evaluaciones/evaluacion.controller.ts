import { FastifyRequest, FastifyReply } from 'fastify';
import { EvaluacionService } from './evaluacion.service';

export class EvaluacionController {
    
    private evaluacionService: EvaluacionService;

    constructor() {
        this.evaluacionService = new EvaluacionService();//Instancia del servicio
    }

    obtenerConfiguracion = async (req: FastifyRequest, reply: FastifyReply) => {
        try {
            const idParam = (req.params as any).id_configuracion;
            // Verificamos que el ID exista y sea un número válido
            if (!idParam || isNaN(Number(idParam))) {
                return reply.code(400).send({
                    success: false,
                    message: "El ID de configuración proporcionado no es válido."
                });
            }

            // Convertimos a BigInt para enviarlo al servicio
            const configuracionIdBigInt = BigInt(idParam);

            //Llamada al servicio
            const configuracion = await this.evaluacionService.obtenerConfiguracionExamen(configuracionIdBigInt);

            //Respuesta si no se encuentra la configuracion
            if (!configuracion) {
                return reply.code(404).send({
                    success: false,
                    message: `No se encontró ninguna configuración con el id ${idParam}`
                });
            }

            //Respuesta exitosa
            return reply.code(200).send({
                success: true,
                configuracion: configuracion
            });

        } catch (error) {
            req.log.error(error);
            //Manejo de errores del servidor
            return reply.code(500).send({
                success: false,
                message: "Ocurrió un error interno al obtener la configuración."
            });
        }
    }
}