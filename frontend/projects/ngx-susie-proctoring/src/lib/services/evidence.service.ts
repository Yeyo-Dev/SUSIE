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

    async startSession(): Promise<void> {
        if (!this.apiUrl) return;
        const url = `${this.apiUrl}/monitoreo/sesiones/start`;
        try {
            await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.authToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    examSessionId: this.sessionContext.examSessionId,
                    examId: this.sessionContext.examId,
                    userId: this.sessionContext.userId || 'anonymous',
                    timestamp: new Date().toISOString()
                })
            });
            this.logger('success', '🟢 Sesión de examen iniciada en el servidor');
        } catch (error) {
            this.logger('error', '⚠️ Falló el registro de inicio de sesión en el servidor');
        }
    }

    async endSession(status: 'submitted' | 'cancelled'): Promise<void> {
        if (!this.apiUrl) return;
        const url = `${this.apiUrl}/monitoreo/sesiones/end`;
        try {
            await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.authToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    examSessionId: this.sessionContext.examSessionId,
                    status,
                    timestamp: new Date().toISOString()
                }),
                keepalive: true // Permite completar el request al cerrar la pestaña
            });
            this.logger('success', `🔴 Sesión de examen finalizada (${status})`);
        } catch (error) {
            this.logger('error', '⚠️ Falló el registro de fin de sesión en el servidor');
        }
    }


    private async uploadEvidence(data: EvidencePayload) {
        if (!this.apiUrl) return;

        // Determinar endpoint según el tipo de evidencia
        let endpointUrl = '';
        let useJson = false;

        if (data.metadata?.payload?.type === 'AUDIO_CHUNK') {
            endpointUrl = `${this.apiUrl}/monitoreo/evidencias/audios`;
        } else if (data.metadata?.payload?.type === 'SNAPSHOT') {
            endpointUrl = `${this.apiUrl}/monitoreo/evidencias/snapshots`;
        } else if (data.metadata?.payload?.type === 'BROWSER_EVENT') {
            endpointUrl = `${this.apiUrl}/monitoreo/evidencias/eventos`;
            useJson = true;
        } else {
            this.logger('info', `ℹ️ Evento local detectado: ${data.metadata?.payload?.type} (No se envía a backend)`);
            return;
        }

        try {
            if (useJson) {
                // Eventos lógicos (BROWSER_EVENT) → JSON POST
                await fetch(endpointUrl, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.authToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        meta: data.metadata.meta || {},
                        payload_info: data.metadata.payload || {}
                    }),
                    keepalive: true
                });
                this.logger('success', `📤 Evento de navegador enviado al servidor (${data.metadata?.payload?.trigger || data.metadata?.payload?.type})`);
            } else {
                // Audio/Snapshots → FormData (multipart)
                const formData = new FormData();
                // El orden es vital para que Fastify no falle
                formData.append('meta', JSON.stringify(data.metadata.meta || {}));
                formData.append('payload_info', JSON.stringify(data.metadata.payload || {}));

                if (data.file) {
                    formData.append('file', data.file);
                }

                await fetch(endpointUrl, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.authToken}`
                    },
                    body: formData,
                    keepalive: true
                });

                // Log de éxito para audio/evidencia
                if (data.file) {
                    const isAudio = data.metadata?.payload?.type === 'AUDIO_CHUNK';
                    const label = isAudio ? 'Audio (15s)' : 'Snapshot';
                    this.logger('success', `📤 ${label} enviado al servidor (${data.file.size} bytes)`);
                }
            }

        } catch (err) {
            const evidenceType = data.metadata?.payload?.type;
            let label = 'evidencia';
            if (evidenceType === 'AUDIO_CHUNK') label = 'audio';
            else if (evidenceType === 'SNAPSHOT') label = 'snapshot';
            else if (evidenceType === 'BROWSER_EVENT') label = 'evento de navegador';

            this.logger('error', `❌ Error al subir ${label}`, err);
            console.error(`[EVIDENCE] Failed to upload ${label}:`, err);
        }
    }

    /**
     * Valida la identidad del candidato enviando su foto al endpoint
     * dedicado de biometría del backend.
     * @returns true si la validación fue exitosa (HTTP 200), false en caso contrario.
     */
    async validateBiometric(photo: Blob, userId: string | number): Promise<boolean> {
        if (!this.apiUrl) {
            this.logger('error', '⚠️ No hay API URL configurada para validación biométrica');
            return false;
        }

        const url = `${this.apiUrl}/usuarios/biometricos/validar`;

        try {
            const formData = new FormData();
            formData.append('meta', JSON.stringify({ usuario_id: userId }));
            formData.append('file', photo);

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.authToken}`
                },
                body: formData
            });

            if (response.ok) {
                this.logger('success', '✅ Validación biométrica exitosa');
                return true;
            } else {
                const body = await response.json().catch(() => ({}));
                this.logger('error', `❌ Validación biométrica fallida (${response.status})`, body);
                return false;
            }
        } catch (err) {
            this.logger('error', '❌ Error de red al validar biometría', err);
            console.error('[EVIDENCE] Biometric validation failed:', err);
            return false;
        }
    }
}
