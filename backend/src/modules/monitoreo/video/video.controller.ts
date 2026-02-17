import { FastifyRequest } from "fastify";
import WebSocket, { createWebSocketStream } from "ws";
import { VideoService } from "./video.service";

//Interfaz para saber que datos esperar en la url
interface VideoQuery {
    id_usuario: number;
    nombre_usuario: string;
    nombre_examen: string;
}

export class VideoController {
    private videoService: VideoService;

    constructor() {//Instanciamos el servicio
        this.videoService = new VideoService();
    }

    //Metodo para recibir el video
    manejadorVideo = async (socket: WebSocket, req: FastifyRequest) => {
        try {
            const query = req.query as VideoQuery;//Obtenemos los datos de la url
            //Obtenemos los datos de la url
            const id_usuario = query.id_usuario || 0;
            const nombre_usuario = query.nombre_usuario || 'desconocido';
            const nombre_examen = query.nombre_examen || 'desconocido';

            //Creamos el nombre del archivo
            const nombreArchivo = `${id_usuario}_${nombre_usuario}_${nombre_examen}_${Date.now()}_video.webm`;

            //Creamos el stream de video
            const webSocketStream = createWebSocketStream(socket);

            //Guardamos el video
            const rutaArchivo = await this.videoService.guardarVideo(webSocketStream, nombreArchivo);
            console.log(`Video guardado en: ${rutaArchivo}`);

            //Enviamos la respuesta al cliente
            socket.send(JSON.stringify({ status: 'success', message: 'Video guardado correctamente', file: nombreArchivo }))
        } catch (error) {
            console.error('Error al manejar el video:', error);
            socket.send(JSON.stringify({ status: 'error', message: 'Error al guardar el video', error: error }))
        }
        finally {
            //Cerramos la conexion si no se cerro por pipeline
            if (socket.readyState === WebSocket.OPEN) {
                socket.close();
            }
        }
    }
}