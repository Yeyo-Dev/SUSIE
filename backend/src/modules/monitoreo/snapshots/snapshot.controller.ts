import { FastifyRequest, FastifyReply } from 'fastify';
import { SnapshotService } from './snapshot.service';
import { SnapshotMetadata, SnapshotPayloadInfo } from './snapshot.interface';

export class SnapshotController {
    private snapshotService: SnapshotService;

    constructor() {//instanciamos el servicio
        this.snapshotService = new SnapshotService();
    }

    manejadorSnapshot = async (req: FastifyRequest, reply: FastifyReply) => {
        try {
            const parts = req.parts();//parts contiene los datos del formulario

            // Variables temporales para ir guardando lo que llega
            let metaData: SnapshotMetadata | null = null;
            let payloadInfo: SnapshotPayloadInfo | null = null;
            let resultadoProceso = null;

            // Iteramos sobre las partes
            for await (const part of parts) {
                if (part.type === 'field') {
                    //Si es campo de texto lo guardamos en memoria
                    if (part.fieldname === 'meta') {//meta contiene la metadata del video
                        metaData = JSON.parse(part.value as string);
                    }
                    else if (part.fieldname === 'payload_info') {//payload_info contiene la informacion tecnica del video
                        payloadInfo = JSON.parse(part.value as string);
                    }
                } else if (part.type === 'file') {//si es un archivo
                    //Se procesa inmediatamente
                    //Validación rápida: ¿Ya llegaron los metadatos?
                    if (!metaData || !payloadInfo) {
                        console.warn("Error: El archivo llegó antes que los metadatos.");
                        // Rechazamos inmediatamente la petición
                        return reply.code(400).send({
                            status: 'error',
                            message: 'El orden del FormData es incorrecto. Envíe "meta" y "payload_info" antes que el "file".'
                        });
                    }

                    // Procesamos inmediatamente (await mantiene el stream vivo)
                    resultadoProceso = await this.snapshotService.procesarEvidencia(
                        part, // Pasamos 'part' directamente
                        metaData || {} as any, // Manejo de riesgo si no hay meta
                        payloadInfo || {} as any
                    );
                    break; //Si procesamos el archivo, salimos del bucle.
                }
            }

            //Respondemos solo cuando todo terminó
            if (resultadoProceso) {//si se procesó el archivo
                return reply.send(resultadoProceso);
            } else {//si no se procesó el archivo
                return reply.code(400).send({ message: 'No se procesó ningún archivo.' });
            }

        } catch (error) {
            console.error('Error procesando evidencia:', error);
            //Si el error es ECONNRESET, no podemos responder porque el cliente se fue
            if (req.raw.destroyed) return;

            return reply.code(500).send({ message: 'Error interno del servidor' });
        }
    }
}