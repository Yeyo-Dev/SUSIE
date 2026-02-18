import { FastifyRequest } from "fastify";
import WebSocket, { createWebSocketStream } from "ws";
import { AudioService } from "./audio.service";

interface AudioQuery {
    id_usuario: number;
    nombre_usuario: string;
    nombre_examen: string;
}

export class AudioController {
    private audioService: AudioService;

    constructor() {
        this.audioService = new AudioService();
    }

    manejadorAudio = async (socket: WebSocket, req: FastifyRequest) => {
        const query = req.query as AudioQuery;
        const id_usuario = query.id_usuario || 0;
        const nombre_usuario = query.nombre_usuario || 'desconocido';
        const nombre_examen = query.nombre_examen || 'desconocido';

        console.log(`[${new Date().toISOString()}] 🎤 Conexión AUDIO iniciada | Usuario: ${nombre_usuario} (${id_usuario}) | Examen: ${nombre_examen}`);

        try {
            // Nombre del archivo con extensión de audio
            const nombreArchivo = `audio_${id_usuario}_${nombre_usuario}_${nombre_examen}_${Date.now()}.ogg`;

            // Convertimos socket a stream
            const webSocketStream = createWebSocketStream(socket);

            // Guardamos usando el servicio de audio
            const rutaArchivo = await this.audioService.guardarAudio(webSocketStream, nombreArchivo);

            // Get file size (requires fs, but for now we just log success)
            console.log(`[${new Date().toISOString()}] ✅ Audio guardado: ${rutaArchivo}`);

            socket.send(JSON.stringify({
                status: 'success',
                message: 'Audio guardado correctamente',
                file: nombreArchivo
            }));

        } catch (error) {
            console.error(`[${new Date().toISOString()}] ❌ Error en stream de audio:`, error);
            socket.send(JSON.stringify({
                status: 'error',
                message: 'Error al guardar el audio',
                error: error
            }));
        } finally {
            // Aseguramos cierre si no se cerró por pipeline
            if (socket.readyState === WebSocket.OPEN) {
                socket.close();
            }
            console.log(`[${new Date().toISOString()}] 🔌 Conexión AUDIO cerrada | Usuario: ${nombre_usuario}`);
        }
    }
}