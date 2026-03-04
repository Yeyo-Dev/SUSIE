import { FastifyRequest, FastifyReply } from "fastify";
import { SesionEvaluacionService } from "./sesion.service";
import { CreateSesionEvaluacionDTO } from "./sesion.interface";

export class SesionEvaluacionController{
    private sesionEvaluacionService: SesionEvaluacionService;

    constructor() {
        // Instanciamos el servicio
        this.sesionEvaluacionService = new SesionEvaluacionService();
    }

    IniciarSesionEvaluacionHandler = async (req: FastifyRequest, reply: FastifyReply) => {
        try {
            // Llamamos al método de la instancia
            const newSesionEvaluacion = await this.sesionEvaluacionService.crearSesionEvaluacion(req.body as CreateSesionEvaluacionDTO);
            reply.status(201).send(newSesionEvaluacion);
        } catch (error) {
            console.error('Error al crear la sesión de evaluación:', error);
            reply.status(500).send({ error: 'Error al crear la sesión de evaluación' });
        }
    }

    FinalizarSesionEvaluacionHandler = async (req: FastifyRequest, reply: FastifyReply) => {
        try {
            const { id_sesion } = req.params as { id_sesion: string };// Aseguramos que el id_sesion se convierta a bigint antes de pasarlo al servicio
            const sesionFinalizada = await this.sesionEvaluacionService.finalizarSesionEvaluacion(BigInt(id_sesion));
            reply.status(200).send(sesionFinalizada);
        } catch (error) {
            console.error('Error al finalizar la sesión de evaluación:', error);
            reply.status(500).send({ error: 'Error al finalizar la sesión de evaluación' });
        }
    }
}