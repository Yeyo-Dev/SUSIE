import { FastifyReply, FastifyRequest } from "fastify";
import { EventoService } from "./evento.service";

export class EventoController {
    
    private eventoService: EventoService;

    constructor() {
        this.eventoService = new EventoService();
    }

    eventosHandler = async (req: FastifyRequest, reply: FastifyReply) => {
        /*try {
            const idParam = (req.params as any).evaluacion_id;
            
            if (!idParam || isNaN(Number(idParam))) {
                return reply.code(400).send({
                    success: false,
                    message: "El ID de evaluación proporcionado no es válido."
                });
            }

            const evaluacionIdBigInt = BigInt(idParam);

            const eventos = await this.eventoService.obtenerEventos(evaluacionIdBigInt);

            if (!eventos) {
                return reply.code(404).send({
                    success: false,
                    message: `No se encontraron eventos para la evaluación ${idParam}`
                });
            }

            return reply.code(200).send({
                success: true,
                eventos: eventos
            });

        } catch (error) {
            req.log.error(error);
            return reply.code(500).send({
                success: false,
                message: "Ocurrió un error interno al obtener los eventos."
            });
        }*/
    }
}