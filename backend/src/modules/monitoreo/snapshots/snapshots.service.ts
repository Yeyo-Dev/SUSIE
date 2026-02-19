import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import { pipeline } from 'stream/promises';
import { MultipartFile } from '@fastify/multipart';
import { SnapshotMetadata, SnapshotPayloadInfo } from './snapshots.interface';

export class SnapshotsService {
    private uploadDir: string;

    constructor() {
        this.uploadDir = path.join(process.cwd(), 'uploads', 'snapshots');
        if (!fs.existsSync(this.uploadDir)) {
            fs.mkdirSync(this.uploadDir, { recursive: true });
        }
    }

    // Función auxiliar para limpiar nombres
    private sanitizarNombre(texto: string): string {
        return texto
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Á -> A
            .toLowerCase()
            .replace(/[^a-z0-9-_]/g, ''); // Solo deja letras, números, guiones
    }

    async procesarEvidencia(
        file: MultipartFile,
        metaData: SnapshotMetadata,
        payloadInfo: SnapshotPayloadInfo
    ) {
        //Componentes del nombre del snapshot
        const examen = this.sanitizarNombre(metaData.nombre_examen || 'examen');
        const usuario = this.sanitizarNombre(metaData.nombre_usuario || 'usuario');
        const timestamp = metaData.timestamp || Date.now();

        // Agregamos el "type" al nombre del archivo para saber si es webcam o pantalla
        const tipoOrigen = this.sanitizarNombre(payloadInfo.type || 'unknown');

        // Construimos el nombre final: examen_usuario_tipo_fecha.jpg
        const nombreArchivo = `${examen}_${usuario}_${tipoOrigen}_${timestamp}.jpg`;
        const rutaCompleta = path.join(this.uploadDir, nombreArchivo);

        try {
            //Guardamos el archivo en disco
            await pipeline(file.file, fs.createWriteStream(rutaCompleta));

            //Obtenemos datos del archivo guardado
            const stats = await fsPromises.stat(rutaCompleta);

            //Simulación de subida a Azure
            const mockUrl = `https://mi-storage.blob.core.windows.net/evidencias/${nombreArchivo}`;

            console.log(`[Service] Archivo guardado: ${nombreArchivo} (${stats.size} bytes) | Origen: ${payloadInfo.source}`);

            //Retornamos la info combinada
            return {
                status: 'success',
                message: 'Evidencia procesada correctamente',
                data: {
                    filename: nombreArchivo,
                    url: mockUrl,
                    size: stats.size,
                    meta: metaData,       // Devolvemos la metadata recibida
                    info_tecnica: payloadInfo // Devolvemos la info técnica confirmando que la leímos
                }
            };

        } catch (error) {
            console.error("Error al guardar snapshot:", error);
            throw new Error("Fallo al escribir el archivo en disco");
        }
    }
}