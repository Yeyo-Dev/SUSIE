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

    private audioSocket: WebSocket | null = null;

    configure(apiUrl: string, authToken: string, sessionContext: any) {
        this.apiUrl = apiUrl;
        this.authToken = authToken;
        this.sessionContext = sessionContext;
    }

    setLogger(fn: (type: 'info' | 'error' | 'success', msg: string, details?: any) => void) {
        this.logger = fn;
    }

    sendEvent(payload: Partial<EvidenceMetadata['payload']>) {
        const metadata: EvidenceMetadata = {
            meta: {
                correlation_id: this.sessionContext.examSessionId,
                exam_id: this.sessionContext.examId,
                student_id: this.sessionContext.userId || 'anonymous',
                timestamp: new Date().toISOString(),
                source: 'frontend_client_v1'
            },
            payload: payload as any
        };

        this.uploadEvidence({ metadata });
    }

    startAudioRecording(stream: MediaStream | null, config: any) {
        if (!stream) {
            this.logger('error', '❌ No hay stream de audio disponible para grabar');
            return;
        }

        // 1. Establecer conexión WebSocket
        try {
            // Transformar http/https a ws/wss y ajustar path
            // apiUrl esperado: http://localhost:8000/api/v1 -> ws://localhost:8000/api/monitoreo/audio
            const baseUrl = this.apiUrl.replace(/\/v1\/?$/, '').replace(/^http/, 'ws');
            const wsUrl = `${baseUrl}/monitoreo/audio?id_usuario=${this.sessionContext.userId || 0}&nombre_usuario=${this.sessionContext.userName || 'student'}&nombre_examen=${this.sessionContext.examId}`;

            this.logger('info', `📡 Conectando WebSocket de audio...`, { url: wsUrl });

            this.audioSocket = new WebSocket(wsUrl);

            this.audioSocket.onopen = () => {
                this.logger('success', '🟢 WebSocket de audio conectado');
                this.initMediaRecorder(stream, config);
            };

            this.audioSocket.onerror = (err) => {
                this.logger('error', '❌ Error en WebSocket de audio', err);
            };

            this.audioSocket.onclose = () => {
                this.logger('info', '🔌 WebSocket de audio desconectado');
            };

        } catch (err: any) {
            this.logger('error', '❌ Error al conectar WebSocket', err);
        }
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
                if (event.data.size > 0 && this.audioSocket?.readyState === WebSocket.OPEN) {
                    this.audioSocket.send(event.data);
                    this.logger('success', `⬆️ Audio chunk enviado (${event.data.size} bytes)`);
                }
            };

            this.mediaRecorder.onerror = (event: any) => {
                this.logger('error', '❌ Error en MediaRecorder', event.error);
            };

            const interval = (config.chunkIntervalSeconds || 10) * 1000;
            this.mediaRecorder.start(interval); // Enviar cada X segundos
            this.logger('success', `🎙️ Streaming de audio iniciado (${mimeType})`, { interval });

        } catch (err: any) {
            this.logger('error', '❌ Falló al iniciar MediaRecorder', err);
        }
    }

    stopAudioRecording() {
        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
            this.mediaRecorder.stop();
            this.logger('info', '🛑 Grabación de audio detenida');
        }
        if (this.audioSocket) {
            this.audioSocket.close();
            this.audioSocket = null;
        }
    }

    private sendAudioChunk(blob: Blob) {
        // Deprecado: ahora se envía por WebSocket directo
    }

    private async uploadEvidence(data: EvidencePayload) {
        if (!this.apiUrl) return;

        const formData = new FormData();
        formData.append('metadata', JSON.stringify(data.metadata));
        if (data.file) {
            formData.append('file', data.file);
        }

        try {
            await fetch(`${this.apiUrl}/evidence`, {
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
