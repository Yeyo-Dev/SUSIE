import { FastifyRequest, FastifyReply } from 'fastify';
import { ExamenService } from './examen.service';
import { PayloadRespuestasDTO } from './examen.interface';

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

    registrarRespuestasHandler = async (req: FastifyRequest, reply: FastifyReply) => {
        try {
            // Extraemos el cuerpo de la petición y lo tipamos
            const payload = req.body as PayloadRespuestasDTO;

            // Validaciones básicas de defensa
            if (!payload.asignacion_id || !payload.examen_id || !payload.usuario_id || !payload.respuestas) {
                return reply.code(400).send({
                    success: false,
                    message: "BAD_REQUEST: Faltan datos obligatorios (asignacion_id, examen_id, usuario_id, respuestas)."
                });
            }

            if (!Array.isArray(payload.respuestas) || payload.respuestas.length === 0) {
                return reply.code(400).send({
                    success: false,
                    message: "BAD_REQUEST: El arreglo de respuestas no puede estar vacío."
                });
            }

            // Llamamos al servicio
            const resultado = await this.examenService.registrarRespuestas(payload);

            // Devolvemos 201 Created
            return reply.code(201).send(resultado);

        } catch (error: any) {
            console.error("Error en ExamenController al guardar respuestas:", error);
            
            if (error.message?.includes('BAD_REQUEST')) {
                return reply.code(400).send({ success: false, message: error.message });
            }

            return reply.code(500).send({
                success: false,
                message: "Error interno del servidor al guardar las respuestas."
            });
        }
    }
}