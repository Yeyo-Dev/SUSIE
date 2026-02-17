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
        console.log('Cliente conectado al stream de AUDIO');
        
        try {
            const query = req.query as AudioQuery;
            
            const id_usuario = query.id_usuario || 0;
            const nombre_usuario = query.nombre_usuario || 'desconocido';
            const nombre_examen = query.nombre_examen || 'desconocido';

            // Nombre del archivo con extensión de audio
            const nombreArchivo = `audio_${id_usuario}_${nombre_usuario}_${nombre_examen}_${Date.now()}.ogg`;
            
            // Convertimos socket a stream
            const webSocketStream = createWebSocketStream(socket);
            
            // Guardamos usando el servicio de audio
            const rutaArchivo = await this.audioService.guardarAudio(webSocketStream, nombreArchivo);
            
            console.log(`Audio guardado en: ${rutaArchivo}`);

            socket.send(JSON.stringify({
                status: 'success', 
                message: 'Audio guardado correctamente', 
                file: nombreArchivo
            }));

        } catch (error) {
            console.error('Error al manejar el audio:', error);
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
        }
    }
}