import { FastifyReply, FastifyRequest } from "fastify";
import { EventoService } from "./evento.service";
import { EventoDataContent } from "./evento.interface";

export class EventoController {
    
    private eventoService: EventoService;

    constructor() {
        this.eventoService = new EventoService();
    }

    registrarEventoHandler = async (req: FastifyRequest, reply: FastifyReply) => {
        try {
            const eventoData = req.body as EventoDataContent;

            const resultado = await this.eventoService.registrarEvento(eventoData);

            return reply.code(201).send(resultado);

        } catch (error: any) {
            if (error.message?.includes("BAD_REQUEST")) {
                return reply.code(400).send({
                    success: false,
                    message: error.message
                });
            }

            if (error.message?.includes("NOT_FOUND")) {
                return reply.code(404).send({
                    success: false,
                    message: error.message
                });
            }

            req.log.error(error);
            return reply.code(500).send({
                success: false,
                message: "Ocurrió un error interno al registrar el evento."
            });
        }
    }
}