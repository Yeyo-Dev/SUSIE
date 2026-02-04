import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { EvidencePayload, SusieConfig } from '../models/contracts';

@Injectable({
    providedIn: 'root'
})
export class EvidenceService {
    private http = inject(HttpClient);

    // Configuración inyectada o establecida al inicio
    private config: SusieConfig | null = null;

    setConfig(config: SusieConfig) {
        this.config = config;
    }

    /**
     * Envía la evidencia al API Gateway.
     * Convierte el payload estricto a FormData para soportar archivos binarios.
     */
    sendEvidence(data: EvidencePayload): Observable<any> {
        if (!this.config) {
            throw new Error('EvidenceService: Configuración no inicializada.');
        }

        const formData = new FormData();

        // 1. Agregar Metadata como JSON string
        formData.append('meta', JSON.stringify(data.meta));

        // 2. Agregar datos del payload (no-binarios)
        const payloadMetadata = {
            type: data.payload.type,
            browser_focus: data.payload.browser_focus
        };
        formData.append('payload_info', JSON.stringify(payloadMetadata));

        // 3. Agregar el archivo binario si existe
        if (data.payload.resource_file) {
            // Nombre de archivo descriptivo: timestamp_type.jpg
            const ext = this.getExtensionForType(data.payload.type);
            const filename = `${data.meta.timestamp}_${data.payload.type}.${ext}`;
            formData.append('file', data.payload.resource_file, filename);
        }

        // Inyectar Authorization header si es necesario (generalmente manejado por Interceptor, 
        // pero aquí lo aseguramos si la librería es standalone)
        const headers = {
            'Authorization': `Bearer ${this.config.authToken}`
        };

        return this.http.post(`${this.config.apiUrl}/evidence`, formData, { headers });
    }

    private getExtensionForType(type: string): string {
        switch (type) {
            case 'SNAPSHOT': return 'jpg';
            case 'AUDIO_CHUNK': return 'webm';
            default: return 'bin';
        }
    }
}
