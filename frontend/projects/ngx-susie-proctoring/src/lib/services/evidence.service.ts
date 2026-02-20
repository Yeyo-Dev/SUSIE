import { Injectable } from '@angular/core';
import { EvidencePayload, EvidenceMetadata } from '../models/contracts';

@Injectable({ providedIn: 'root' })
export class EvidenceService {
    private apiUrl = '';
    private authToken = '';
    private sessionContext: any = {};
    private mediaRecorder: MediaRecorder | null = null;
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




    private initMediaRecorder(stream: MediaStream, config: any) {
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

            const interval = (config.chunkIntervalSeconds || 15) * 1000;
            this.mediaRecorder.start(interval); // Enviar cada X segundos
            this.logger('success', `🎙️ Streaming de audio iniciado (${mimeType})`, { interval });

        } catch (err: any) {
            this.logger('error', '❌ Falló al iniciar MediaRecorder', err);
        }
    }

    stopAudioRecording() {
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

        // Determinar endpoint según el tipo de evidencia (asumimos que Snapshot y Audio llegan aquí)
        // Por simplicidad, podemos usar una lógica condicional basada en el 'type'
        let endpointUrl = `${this.apiUrl}/evidencias/snapshots`; // default a snapshots si no es audio
        if (data.metadata?.payload?.type === 'AUDIO_CHUNK') {
            endpointUrl = `${this.apiUrl}/evidencias/audios`;
        } else if (data.metadata?.payload?.type === 'SNAPSHOT') {
            endpointUrl = `${this.apiUrl}/evidencias/snapshots`;
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
                body: formData
            });

            // Log de éxito para audio/evidencia
            if (data.file) { // Solo loguear si hay archivo (audio/snapshot)
                this.logger('success', `📤 Evidencia enviada: ${data.file.size} bytes`);
            }

        } catch (err) {
            this.logger('error', '❌ Falló subida de evidencia', err);
            console.error('Failed to upload evidence', err);
        }
    }
}
