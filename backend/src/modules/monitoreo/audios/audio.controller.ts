import { FastifyRequest, FastifyReply } from 'fastify';
import { AudioService } from './audio.service';
import { AudioMetadata, AudioPayloadInfo } from './audio.interface';

export class AudioController {
    private audioService: AudioService;

    constructor() {//instancia de audio service
        this.audioService = new AudioService();
    }

    manejadorAudio = async (req: FastifyRequest, reply: FastifyReply) => {
        try {
            const parts = req.parts();

            let metaData: AudioMetadata | null = null;
            let payloadInfo: AudioPayloadInfo | null = null;
            let resultadoProceso = null;

            for await (const part of parts) {
                if (part.type === 'field') {
                    if (part.fieldname === 'meta') {
                        metaData = JSON.parse(part.value as string);
                    }
                    else if (part.fieldname === 'payload_info') {
                        payloadInfo = JSON.parse(part.value as string);
                    }
                } else if (part.type === 'file') {
                    if (!metaData || !payloadInfo) {
                        console.warn("Error: El fragmento de audio llegó antes que los metadatos.");
                        return reply.code(400).send({
                            status: 'error',
                            message: 'El orden del FormData es incorrecto. Envíe "meta" y "payload_info" antes que el "file".'
                        });
                    }
                    console.log(`\n[Audio Controller] 📥 Recibiendo nuevo fragmento de audio (15s) de usuario...`);

                    resultadoProceso = await this.audioService.procesarEvidencia(
                        part,
                        metaData,
                        payloadInfo
                    );
                    break;
                }
            }

            if (resultadoProceso) {
                return reply.send(resultadoProceso);
            } else {
                return reply.code(400).send({ message: 'No se procesó ningún fragmento de audio.' });
            }

        } catch (error) {
            console.error('Error procesando fragmento de audio:', error);
            if (req.raw.destroyed) return;
            return reply.code(500).send({ message: 'Error interno del servidor al procesar audio' });
        }
    }
}