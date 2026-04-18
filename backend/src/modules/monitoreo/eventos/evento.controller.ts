import { FastifyReply, FastifyRequest } from "fastify";
import { EventoService } from "./evento.service";
import { EventoRequestBody } from "./evento.interface";

export class EventoController {

    private eventoService: EventoService;

    constructor() {
        this.eventoService = new EventoService();
    }

    /**
     * POST /monitoreo/evidencias/eventos
     * Recibe eventos del navegador (tab switch, devtools, clipboard, etc.)
     * y los registra en Redis + PostgreSQL.
     */
    crearEventoHandler = async (req: FastifyRequest, reply: FastifyReply) => {
        try {
            const body = req.body as EventoRequestBody;

            // Validación básica
            if (!body.meta || !body.payload_info) {
                return reply.code(400).send({
                    status: 'error',
                    message: 'Faltan campos requeridos: meta y payload_info',
                });
            }

            if (!body.meta.sesion_id || !body.meta.student_id) {
                return reply.code(400).send({
                    status: 'error',
                    message: 'meta.sesion_id y meta.student_id son requeridos',
                });
            }

            if (body.payload_info.type !== 'BROWSER_EVENT') {
                return reply.code(400).send({
                    status: 'error',
                    message: 'payload_info.type debe ser BROWSER_EVENT',
                });
            }

            const resultado = await this.eventoService.registrarEvento(
                body.meta,
                body.payload_info,
                req.server
            );

            return reply.code(201).send(resultado);

        } catch (error) {
            req.log.error(error);
            return reply.code(500).send({
                status: 'error',
                message: 'Error interno al registrar el evento',
            });
        }
    }
}