import fs from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';

export class AudioService {
    private direccionCarga: string;

    constructor() {
        //Carpeta específica para audios
        this.direccionCarga = path.join(process.cwd(), 'uploads', 'audios');
        
        if (!fs.existsSync(this.direccionCarga)) {
            fs.mkdirSync(this.direccionCarga, { recursive: true });
        }
    }

    async guardarAudio(stream: any, nombreArchivo?: string): Promise<string> {
        const fechaActual = Date.now();
        
        //Extensión .ogg (u .opus/.webm) para audio
        let nombreArchivoSeguro = nombreArchivo
            ? nombreArchivo.replace(/[^a-zA-Z0-9-_\.]/g, '')
            : `audio-${fechaActual}.ogg`;

        const rutaArchivo = path.join(this.direccionCarga, nombreArchivoSeguro);
        const streamEscritura = fs.createWriteStream(rutaArchivo);

        try {
            await pipeline(stream, streamEscritura);
            return rutaArchivo;
        } catch (error) {
            console.error('Error al guardar el audio:', error);
            throw error;
        }
    }
}