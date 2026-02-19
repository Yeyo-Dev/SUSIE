import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import { pipeline } from 'stream/promises';
import { MultipartFile } from '@fastify/multipart';
import { AudioMetadata, AudioPayloadInfo } from './audio.interface';

export class AudioService {
    private uploadDir: string;

    constructor() {
        this.uploadDir = path.join(process.cwd(), 'uploads', 'audio_fragments');
        if (!fs.existsSync(this.uploadDir)) {
            fs.mkdirSync(this.uploadDir, { recursive: true });
        }
    }

    private sanitizarNombre(texto: string): string {
        return texto
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "") 
            .toLowerCase()
            .replace(/[^a-z0-9-_]/g, ''); 
    }

    async procesarEvidencia(
        file: MultipartFile,
        metaData: AudioMetadata,
        payloadInfo: AudioPayloadInfo
    ) {
        const examen = this.sanitizarNombre(metaData.nombre_examen || 'examen');
        const usuario = this.sanitizarNombre(metaData.nombre_usuario || 'usuario');
        const timestamp = metaData.timestamp || Date.now();
        // Aseguramos que el índice tenga al menos 4 dígitos (ej. 0001, 0002) para un ordenamiento alfabético correcto en el SO
        const indice = String(metaData.fragmento_indice || 0).padStart(4, '0');
        const tipoOrigen = this.sanitizarNombre(payloadInfo.type || 'audio');

        // Nombre final: examen_usuario_audio_0001_fecha.webm
        const nombreArchivo = `${examen}_${usuario}_${tipoOrigen}_${indice}_${timestamp}.webm`;
        const rutaCompleta = path.join(this.uploadDir, nombreArchivo);

        try {
            await pipeline(file.file, fs.createWriteStream(rutaCompleta));
            const stats = await fsPromises.stat(rutaCompleta);

            // Simulación Azure
            const mockUrl = `https://mi-storage.blob.core.windows.net/audios/${nombreArchivo}`;

            console.log(`[Audio Service] Fragmento guardado: ${nombreArchivo} (${stats.size} bytes)`);

            return {
                status: 'success',
                message: 'Fragmento de audio procesado correctamente',
                data: {
                    filename: nombreArchivo,
                    url: mockUrl,
                    size: stats.size,
                    meta: metaData,
                    info_tecnica: payloadInfo
                }
            };

        } catch (error) {
            console.error("Error al guardar fragmento de audio:", error);
            throw new Error("Fallo al escribir el archivo de audio en disco");
        }
    }
}