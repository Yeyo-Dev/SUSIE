import fs from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';

export class VideoService {
    private direccionCarga: string;

    constructor() {
        // Directorio donde se guardaran los videos
        this.direccionCarga = path.join(process.cwd(), 'uploads', 'videos');
        // Si no existe el directorio, se crea
        if (!fs.existsSync(this.direccionCarga)) {
            fs.mkdirSync(this.direccionCarga, { recursive: true });
        }
    }

    //Recibe un stream de video y lo guarda en el directorio de carga
    async guardarVideo(stream: any, nombreArchivo?: string): Promise<string> {
        //Obtenemos la fecha actual y la convertimos a string
        const fechaActual = new Date();
        // LIMPIEZA DE SEGURIDAD:
        // Reemplazamos cualquier caracter que no sea letra, numero, guion o punto.
        // Esto evita ataques de "Directory Traversal".
        let nombreArchivoSeguro = nombreArchivo
            ? nombreArchivo.replace(/[^a-zA-Z0-9-_\.]/g, '')
            : `video_${fechaActual}.webm`;

        // Ruta completa del archivo
        const rutaArchivo = path.join(this.direccionCarga, nombreArchivoSeguro);
        //Stream de escritura
        const streamEscritura = fs.createWriteStream(rutaArchivo);


        try {
            await pipeline(stream, streamEscritura);
            return rutaArchivo;
        } catch (error) {
            console.error('Error al guardar el video:', error);
            throw error;
        }
    }
}