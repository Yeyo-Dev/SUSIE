import { FastifyInstance } from "fastify";
import {
    MetadataEvento,
    EventoPayloadInfo,
    TRIGGER_TO_TIPO_INFRACCION,
    TRIGGER_DESCRIPTIONS,
} from "./evento.interface";
import { InfraccionService } from "../infracciones/infraccion.service";

export class EventoService {
    private infraccionService: InfraccionService;

    constructor() {
        this.infraccionService = new InfraccionService();
    }

    /**
     * Registra un evento del navegador:
     * 1. Guarda en Redis como browser_event (RPUSH a la lista de logs de la sesión)
     * 2. Crea un registro de infracción en PostgreSQL
     */
    async registrarEvento(
        metadata: MetadataEvento,
        payloadInfo: EventoPayloadInfo,
        app: FastifyInstance
    ) {
        const timestamp = new Date(metadata.timestamp).toISOString();

        // ── 1. Guardar en Redis (RPUSH) ─────────────────────────
        // Misma lista que usan los workers de IA para que el Motor
        // de Inferencia los recoja con LRANGE al cierre de sesión
        try {
            const redis = app.redis;
            if (redis) {
                const key = `logs:${metadata.sesion_id}:${metadata.student_id}`;
                const browserEvent = {
                    timestamp: timestamp,
                    user_id: metadata.student_id,
                    sesion_id: metadata.sesion_id,
                    source: "browser_event",
                    trigger: payloadInfo.trigger,
                    duration_seconds: payloadInfo.duration_seconds || 0,
                    details: {
                        exam_id: metadata.exam_id,
                        description: TRIGGER_DESCRIPTIONS[payloadInfo.trigger] || payloadInfo.trigger,
                    },
                };
                await redis.rpush(key, JSON.stringify(browserEvent));
                await redis.expire(key, 86400); // 24h TTL
                app.log.info(
                    `[EventoService] Browser event RPUSH → ${key} (trigger=${payloadInfo.trigger})`
                );
            }
        } catch (error) {
            app.log.error(error, 'Error guardando evento en Redis');
        }

        // ── 2. Guardar infracción en PostgreSQL ─────────────────
        try {
            const tipoInfraccion = TRIGGER_TO_TIPO_INFRACCION[payloadInfo.trigger] || "OTRO";
            const detalles = TRIGGER_DESCRIPTIONS[payloadInfo.trigger] || payloadInfo.trigger;

            await this.infraccionService.crearInfraccion({
                id_sesion: metadata.sesion_id,
                minuto_infraccion: timestamp,
                tipo_infraccion: tipoInfraccion as any,
                detalles_infraccion: detalles,
                url_azure_evidencia: null,
            });

            app.log.info(`[EventoService] Infracción guardada en BD: ${payloadInfo.trigger}`);
        } catch (error) {
            app.log.error(error, 'Error guardando infracción en BD');
        }

        return {
            status: "ok",
            message: `Evento ${payloadInfo.trigger} registrado correctamente`,
        };
    }
}