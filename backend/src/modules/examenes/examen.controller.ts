import { FastifyRequest, FastifyReply } from 'fastify';
import { ExamenService } from './examen.service';

export class ExamenController {
    
    private examenService: ExamenService;

    constructor() {//instanciamos el servicio
        this.examenService = new ExamenService();
    }

    obtenerExamenHandler = async (req: FastifyRequest, reply: FastifyReply) => {
        try {
            // Extraemos el ID de los parámetros de la URL
            const idParam = (req.params as any).examen_id;
            
            //Validamos que el ID sea un número
            if (!idParam || isNaN(Number(idParam))) {
                return reply.code(400).send({
                    success: false,
                    message: "BAD_REQUEST: El ID del examen proporcionado no es válido."
                });
            }

            //Llamamos al servicio
            const examenData = await this.examenService.obtenerExamenConPreguntas(idParam);

            //Manejo de no encontrado
            if (!examenData) {
                return reply.code(404).send({
                    success: false,
                    message: `NOT_FOUND: No se encontró ningún examen con el ID ${idParam}.`
                });
            }

            //Respuesta exitosa
            return reply.code(200).send({
                success: true,
                data: examenData
            });

        } catch (error) {
            console.error("Error en ExamenController:", error);
            return reply.code(500).send({
                success: false,
                message: "Error interno del servidor al obtener el examen."
            });
        }
    }
}