import { FastifyRequest, FastifyReply } from 'fastify';
import { GazeService } from './gaze.service';
import { GazeData } from './gaze.interface';

export class GazeController {
    
    private gazeService: GazeService;

    constructor() {
        this.gazeService = new GazeService();
    }

    recepcionGazeHandler = async (req: FastifyRequest, reply: FastifyReply) => {
        try {
            // Extraemos el body tipándolo con nuestra interfaz
            const gazeData = req.body as GazeData;

            // Llamamos al servicio para validar y encolar
            const resultado = await this.gazeService.procesarGazeData(gazeData);

            // Respondemos 202 Accepted
            return reply.code(202).send(resultado);

        } catch (error: any) {
            // Errores de validación 400
            if (error.message?.includes('BAD_REQUEST')) {
                return reply.code(400).send({
                    success: false,
                    message: error.message
                });
            }

            // Errores internos de servidor 500
            console.error("Error en GazeController:", error);
            return reply.code(500).send({
                success: false,
                message: "Error interno al procesar los datos biométricos oculares."
            });
        }
    }
}