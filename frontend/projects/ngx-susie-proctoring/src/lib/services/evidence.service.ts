import { Injectable } from '@angular/core';
import { EvidencePayload, EvidenceMetadata } from '../models/contracts';

@Injectable({ providedIn: 'root' })
export class EvidenceService {
    private apiUrl = '';
    private authToken = '';
    private sessionContext: any = {};
    private mediaRecorder: MediaRecorder | null = null;
    private recordingInterval: any = null;
    private audioChunks: Blob[] = [];

    private logger: (type: 'info' | 'error' | 'success', msg: string, details?: any) => void = () => { };


    configure(apiUrl: string, authToken: string, sessionContext: any) {
        this.apiUrl = apiUrl;
        this.authToken = authToken;
        this.sessionContext = sessionContext;
    }

    setLogger(fn: (type: 'info' | 'error' | 'success', msg: string, details?: any) => void) {
        this.logger = fn;
    }

    sendEvent(payload: Partial<EvidenceMetadata['payload']> & { file?: Blob }) {
        const { file, ...restPayload } = payload;

        const metadata: EvidenceMetadata = {
            meta: {
                correlation_id: this.sessionContext.examSessionId,
                exam_id: this.sessionContext.examId,
                student_id: this.sessionContext.userId || 'anonymous',
                timestamp: new Date().toISOString(),
                source: 'frontend_client_v1'
            },
            payload: restPayload as any
        };

        this.uploadEvidence({ metadata, file });
    }


    startAudioRecording(stream: MediaStream | null, config: any) {
        if (!stream) {
            this.logger('error', '❌ No hay stream de audio disponible para grabar');
            return;
        }
        this.initMediaRecorder(stream, config);
    }




    private handleUnload = () => {
        if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
            // Detener el grabador fuerza a que dispare el evento ondataavailable
            // con el fragmento de audio restante.
            this.mediaRecorder.stop();
        }
    };

    private initMediaRecorder(stream: MediaStream, config: any) {
        window.addEventListener('beforeunload', this.handleUnload);

        try {
            const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
                ? 'audio/webm;codecs=opus'
                : 'audio/webm';

            this.mediaRecorder = new MediaRecorder(stream, {
                mimeType,
                audioBitsPerSecond: config.bitrate || 32000
            });

            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.sendAudioChunk(event.data);
                }
            };


            this.mediaRecorder.onerror = (event: any) => {
                this.logger('error', '❌ Error en MediaRecorder', event.error);
            };

            const interval = ((config.chunkIntervalSeconds || 15) * 1000) + 500;

            // Iniciar el primer segmento
            this.mediaRecorder.start();

            // Detener y reiniciar periódicamente para asegurar que cada chunk sea un archivo WebM completamente válido e independiente
            this.recordingInterval = setInterval(() => {
                if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
                    this.mediaRecorder.stop();
                    this.mediaRecorder.start();
                }
            }, interval);

            this.logger('success', `🎙️ Grabación de audio por bloques iniciada (${mimeType})`, { interval });

        } catch (err: any) {
            this.logger('error', '❌ Falló al iniciar MediaRecorder', err);
        }
    }

    stopAudioRecording() {
        window.removeEventListener('beforeunload', this.handleUnload);
        if (this.recordingInterval) {
            clearInterval(this.recordingInterval);
            this.recordingInterval = null;
        }
        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
            this.mediaRecorder.stop();
            this.logger('info', '🛑 Grabación de audio detenida'); // Updated log message
        }
    }

    private sendAudioChunk(blob: Blob) {
        this.sendEvent({
            type: 'AUDIO_CHUNK',
            browser_focus: document.hasFocus(),
            file: blob
        });
        // Logging moved to uploadEvidence for consistency
    }


    private async uploadEvidence(data: EvidencePayload) {
        if (!this.apiUrl) return;

        // Determinar endpoint según el tipo de evidencia
        let endpointUrl = '';
        if (data.metadata?.payload?.type === 'AUDIO_CHUNK') {
            endpointUrl = `${this.apiUrl}/monitoreo/evidencias/audios`;
        } else if (data.metadata?.payload?.type === 'SNAPSHOT') {
            endpointUrl = `${this.apiUrl}/monitoreo/evidencias/snapshots`;
        } else {
            // Ignorar otros eventos temporalmente (por ej. BROWSER_EVENT) para no generar errores 404/400
            this.logger('info', `ℹ️ Evento local detectado: ${data.metadata?.payload?.type} (No se envía a backend)`);
            return;
        }

        const formData = new FormData();
        // El orden es vital para que Fastify no falle
        formData.append('meta', JSON.stringify(data.metadata.meta || {}));
        formData.append('payload_info', JSON.stringify(data.metadata.payload || {}));

        if (data.file) {
            formData.append('file', data.file);
        }

        try {
            await fetch(endpointUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.authToken}`
                },
                body: formData,
                keepalive: true // Permite que la petición sobreviva el cierre del navegador
            });

            // Log de éxito para audio/evidencia
            if (data.file) { // Solo loguear si hay archivo (audio/snapshot)
                const isAudio = data.metadata?.payload?.type === 'AUDIO_CHUNK';
                const label = isAudio ? 'Audio (15s)' : 'Snapshot';
                this.logger('success', `📤 ${label} enviado al servidor (${data.file.size} bytes)`);
            }

        } catch (err) {
            this.logger('error', '❌ Falló subida de evidencia', err);
            console.error('Failed to upload evidence', err);
        }
    }
}
