import { CreateSesionEvaluacionDTO } from "./sesion.interface";
import prisma from "../../config/prisma";
import { broker } from "../../server";

export class SesionEvaluacionService {

    // Crea una nueva sesión de evaluación en la base de datos.
    async crearSesionEvaluacion(data: CreateSesionEvaluacionDTO) {
        try {
            const nuevaSesionEvaluacion = await prisma.sesion_evaluacion.create({
                data: {
                    id_asignacion: data.id_asignacion,
                    fecha_inicio: new Date(),
                    estado_sesion: 'EN_CURSO',
                },
            });
            return nuevaSesionEvaluacion;
        } catch (error) {
            console.error('Error en SesionEvaluacionService:', error);
            throw new Error('No se pudo guardar la sesion de evaluacion en la base de datos');
        }
    }

    /**
     * Finaliza una sesión de evaluación:
     * 1. Actualiza el estado en PostgreSQL a 'FINALIZADA'
     * 2. Publica un mensaje en q_evidencia para disparar el Motor de Inferencia
     *    → El motor lee todos los logs de Redis, genera el dictamen,
     *      sube el JSON a Azure y guarda el veredicto en la BD.
     */
    async finalizarSesionEvaluacion(id_sesion: bigint, user_id?: string) {
        try {
            // 1. Actualizar estado en BD
            const sesionActualizada = await prisma.sesion_evaluacion.update({
                where: { id_sesion },
                data: {
                    estado_sesion: 'FINALIZADA',
                    fecha_fin: new Date(),
                },
            });

            // 2. Publicar en q_evidencia para disparar el Motor de Inferencia
            // Este mensaje le dice al motor: "la sesión X terminó, procesa TODO"
            try {
                if (broker) {
                    const mensaje = {
                        sesion_id: id_sesion.toString(),
                        user_id: user_id || sesionActualizada.id_asignacion?.toString() || 'unknown',
                        timestamp: new Date().toISOString(),
                        action: 'SESSION_CLOSED',
                    };

                    // Publicamos directamente a la cola q_evidencia (no al exchange)
                    const channel = (broker as any).app?.amqp?.channel;
                    if (channel) {
                        channel.sendToQueue(
                            'q_evidencia',
                            Buffer.from(JSON.stringify(mensaje)),
                            { persistent: true, contentType: 'application/json' }
                        );
                        console.log(`[Sesion] Mensaje enviado a q_evidencia: sesion=${id_sesion}`);
                    }
                }
            } catch (mqError) {
                // No fallar la finalización si RabbitMQ no está disponible
                console.error('Error publicando a q_evidencia (no bloqueante):', mqError);
            }

            return sesionActualizada;
        } catch (error) {
            console.error('Error al finalizar la sesión de evaluación:', error);
            throw new Error('No se pudo finalizar la sesión de evaluación en la base de datos');
        }
    }
}