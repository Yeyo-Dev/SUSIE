import { Injectable, inject } from '@angular/core';
import { EvidenceQueueService } from './evidence-queue.service';
import { DestroyRefUtility } from '../utils/destroy-ref.utility';
import {
    EvidencePayload,
    EvidenceMetadata,
    BackendSesionResponse,
    BackendInfraccionPayload,
    BackendInfraccionTipo,
    calcularMinutoInfraccion,
    LoggerFn,
    AudioRecordingConfig,
    SessionContextData,
    IntervalHandle,
    MediaRecorderErrorEvent,
} from '../models/contracts';

@Injectable({ providedIn: 'root' })
export class EvidenceService {
    private apiUrl = '';
    private authToken = '';
    private sessionContext: SessionContextData = {} as SessionContextData;
    private mediaRecorder: MediaRecorder | null = null;
    private recordingInterval: IntervalHandle | undefined;
    private audioChunks: Blob[] = [];

    /** Cola de reintentos offline (IndexedDB). */
    private queue = inject(EvidenceQueueService);
    private cleanup = inject(DestroyRefUtility);

    /** ID de sesión remota devuelto por POST /sesiones/ */
    private remoteSessionId: string | null = null;
    /** Marca de tiempo de inicio de la sesión (para calcular minuto_infraccion). */
    private sessionStartTime: Date | null = null;
    /** Índice secuencial para fragmentos de audio. */
    private audioFragmentIndex = 0;

    private logger: LoggerFn = () => { };


    configure(apiUrl: string, authToken: string, sessionContext: SessionContextData) {
        this.apiUrl = apiUrl;
        this.authToken = authToken;
        this.sessionContext = sessionContext;

        // Initialize offline queue
        this.queue.setLogger(this.logger);
        this.queue.setAuthToken(authToken);
        this.queue.init();
    }

    setLogger(fn: LoggerFn) {
        this.logger = fn;
    }

    /** Obtiene el ID de sesión remota (solo disponible después de startSession). */
    getRemoteSessionId(): string | null {
        return this.remoteSessionId;
    }

    sendEvent(payload: Partial<EvidenceMetadata['_internal']> & { file?: Blob }) {
        const { file, ...restPayload } = payload;

        // Build the meta object aligned with the backend contract
        const metadata: EvidenceMetadata = {
            meta: {
                sesion_id: Number(this.remoteSessionId) || 0,
                usuario_id: Number(this.sessionContext.userId) || 0,
                nombre_usuario: String(this.sessionContext.userName || this.sessionContext.userId || 'anonymous'),
                examen_id: Number(this.sessionContext.examId) || 0,
                nombre_examen: this.sessionContext.examTitle || '',
                timestamp: Date.now(),
            },
            payload_info: this.resolvePayloadInfo(restPayload.type as any),
            _internal: restPayload as any,
        };

        this.uploadEvidence({ metadata, file });
    }

    /**
     * Resuelve el payload_info correcto según el tipo de evidencia interna.
     */
    private resolvePayloadInfo(
        internalType?: 'SNAPSHOT' | 'AUDIO_CHUNK' | 'BROWSER_EVENT' | 'FOCUS_LOST'
    ): EvidenceMetadata['payload_info'] {
        switch (internalType) {
            case 'AUDIO_CHUNK':
                return { type: 'audio_segment', source: 'microphone' };
            case 'SNAPSHOT':
                return { type: 'snapshot_webcam', source: 'web' };
            default:
                // Browser events and focus lost don't match the multipart pattern.
                // Return a default; uploadEvidence handles the routing.
                return { type: 'snapshot_webcam', source: 'web' };
        }
    }


    startAudioRecording(stream: MediaStream | null, config: AudioRecordingConfig) {
        if (!stream) {
            this.logger('error', '❌ No hay stream de audio disponible para grabar');
            return;
        }
        this.audioFragmentIndex = 0;
        this.initMediaRecorder(stream, config);
    }




    private handleUnload = () => {
        if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
            this.mediaRecorder.stop();
        }
    };

    private initMediaRecorder(stream: MediaStream, config: AudioRecordingConfig) {
        this.cleanup.addEventListener(window, 'beforeunload', this.handleUnload);

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


            this.mediaRecorder.onerror = (event: Event) => {
                const error = (event as any).error;
                this.logger('error', '❌ Error en MediaRecorder', error);
            };

            const interval = ((config.chunkIntervalSeconds || 15) * 1000) + 500;

            this.mediaRecorder.start();

            this.recordingInterval = this.cleanup.setInterval(() => {
                if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
                    this.mediaRecorder.stop();
                    this.mediaRecorder.start();
                }
            }, interval);

            this.logger('success', `🎙️ Grabación de audio por bloques iniciada (${mimeType})`, { interval });

        } catch (err: unknown) {
            this.logger('error', '❌ Falló al iniciar MediaRecorder', err);
        }
    }

    stopAudioRecording() {
        this.cleanup.removeEventListener(window, 'beforeunload', this.handleUnload);
        if (this.recordingInterval) {
            this.cleanup.clearInterval(this.recordingInterval);
            this.recordingInterval = undefined;
        }
        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
            this.mediaRecorder.stop();
            this.logger('info', '🛑 Grabación de audio detenida');
        }
    }

    private sendAudioChunk(blob: Blob) {
        this.audioFragmentIndex++;
        this.sendEvent({
            type: 'AUDIO_CHUNK',
            browser_focus: document.hasFocus(),
            file: blob
        } as any);
    }

    /**
     * Inicia una sesión de evaluación en el backend.
     * Usa POST /sesiones/ con id_asignacion.
     * @returns El id_sesion real del backend, o null si falló.
     */
    async startSession(): Promise<string | null> {
        if (!this.apiUrl) return null;
        const url = `${this.apiUrl}/sesiones`;
        const assignmentId = this.sessionContext.assignmentId;

        if (!assignmentId) {
            this.logger('error', '⚠️ No hay assignmentId (id_asignacion) configurado. No se puede crear sesión.');
            return null;
        }

        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.authToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ id_asignacion: Number(assignmentId) })
            });

            if (!res.ok) {
                throw new Error(`HTTP ${res.status}`);
            }

            const sesion: BackendSesionResponse = await res.json();
            this.remoteSessionId = sesion.id_sesion;
            this.sessionStartTime = new Date(sesion.fecha_inicio);
            this.logger('success', `🟢 Sesión de examen creada en el backend (id_sesion: ${sesion.id_sesion})`);
            return sesion.id_sesion;
        } catch (error) {
            this.logger('error', '⚠️ Falló la creación de sesión en el servidor', error);
            return null;
        }
    }

    /**
     * Finaliza la sesión activa en el backend.
     * Usa POST /sesiones/finalizar/:id_sesion.
     */
    async endSession(status: 'submitted' | 'cancelled'): Promise<void> {
        if (!this.apiUrl || !this.remoteSessionId) return;
        const url = `${this.apiUrl}/sesiones/finalizar/${this.remoteSessionId}`;
        try {
            await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.authToken}`,
                },
                keepalive: true
            });
            this.logger('success', `🔴 Sesión de examen finalizada (${status}, id_sesion: ${this.remoteSessionId})`);
        } catch (error) {
            this.logger('error', '⚠️ Falló el registro de fin de sesión en el servidor');
        }
    }


    private async uploadEvidence(data: EvidencePayload) {
        if (!this.apiUrl) return;

        const internalType = data.metadata?._internal?.type;

        // Determinar endpoint según el tipo de evidencia
        let endpointUrl = '';

        if (internalType === 'AUDIO_CHUNK') {
            endpointUrl = `${this.apiUrl}/monitoreo/evidencias/audios`;
            // Inyectar fragmento_indice en meta
            data.metadata.meta.fragmento_indice = this.audioFragmentIndex;
        } else if (internalType === 'SNAPSHOT') {
            endpointUrl = `${this.apiUrl}/monitoreo/evidencias/snapshots`;
        } else if (internalType === 'BROWSER_EVENT') {
            // Browser events ahora se envían como infracciones dedicadas.
            await this.sendInfraccion(data);
            return;
        } else {
            this.logger('info', `ℹ️ Evento local detectado: ${internalType} (No se envía a backend)`);
            return;
        }

        try {
            // Audio/Snapshots → FormData (multipart)
            // Orden obligatorio: meta → payload_info → file
            const formData = new FormData();
            formData.append('meta', JSON.stringify(data.metadata.meta));
            formData.append('payload_info', JSON.stringify(data.metadata.payload_info));

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

            if (data.file) {
                const isAudio = internalType === 'AUDIO_CHUNK';
                const label = isAudio ? 'Audio (15s)' : 'Snapshot';
                this.logger('success', `📤 ${label} enviado al servidor (${data.file.size} bytes)`);
            }

         } catch (err) {
             let label = 'evidencia';
             if (internalType === 'AUDIO_CHUNK') label = 'audio';
             else if (internalType === 'SNAPSHOT') label = 'snapshot';
 
             this.logger('info', `📥 ${label} encolado offline (red no disponible)`);
 
             // Persist in IndexedDB for retry when the network recovers
            this.queue.enqueueMultipart(
                endpointUrl,
                data.metadata.meta,
                data.metadata.payload_info,
                data.file
            );
        }
    }

    /**
     * Envía las coordenadas de la mirada al endpoint del backend para generar mapas de calor.
     */
    async sendGazeData(points: { x: number, y: number }[]): Promise<void> {
        if (!this.remoteSessionId || !this.apiUrl) {
            return;
        }

        const url = `${this.apiUrl}/monitoreo/evidencias/gaze_tracking`;
        const payload = {
            sesion_id: Number(this.remoteSessionId),
            timestamp: new Date().toISOString(),
            gaze_points: points
        };

        try {
            await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.authToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload),
                keepalive: true
            });
            this.logger('success', `📤 Datos de seguimiento ocular enviados (${points.length} puntos)`);
             } catch (err) {
                 this.logger('info', '📥 Datos de gaze tracking encolados offline');
 
                 this.queue.enqueueJson(url, payload);
             }
    }

    /**
     * Envía una infracción al endpoint dedicado POST /monitoreo/infracciones/.
     * Mapea los triggers internos del frontend a los tipos de infracción del backend.
     */
    private async sendInfraccion(data: EvidencePayload): Promise<void> {
        if (!this.remoteSessionId) {
            this.logger('error', '⚠️ No hay sesión remota activa. No se puede registrar infracción.');
            return;
        }

        const trigger = data.metadata?._internal?.trigger || '';

        // Mapear trigger del frontend → tipo de infracción del backend
        const tipoMap: Record<string, BackendInfraccionTipo> = {
            'TAB_SWITCH': 'CAMBIO_DE_PESTAÑA',
            'FULLSCREEN_EXIT': 'OTRO',
            'DEVTOOLS_OPENED': 'OTRO',
            'LOSS_FOCUS': 'CAMBIO_DE_PESTAÑA',
            'NAVIGATION_ATTEMPT': 'OTRO',
            'RELOAD_ATTEMPT': 'OTRO',
            'CLIPBOARD_ATTEMPT': 'OTRO',
            'GAZE_DEVIATION': 'OTRO',
        };

        const tipoInfraccion: BackendInfraccionTipo = tipoMap[trigger] || 'OTRO';

        const minuteStr = this.sessionStartTime
            ? calcularMinutoInfraccion(this.sessionStartTime)
            : '00:00:00';

        const detallesMap: Record<string, string> = {
            'TAB_SWITCH': 'El alumno cambió de pestaña',
            'FULLSCREEN_EXIT': 'El alumno salió de pantalla completa',
            'DEVTOOLS_OPENED': 'El alumno intentó abrir herramientas de desarrollador',
            'LOSS_FOCUS': 'El alumno perdió el foco de la ventana',
            'NAVIGATION_ATTEMPT': 'El alumno intentó navegar fuera de la página',
            'RELOAD_ATTEMPT': 'El alumno intentó recargar la página',
            'CLIPBOARD_ATTEMPT': 'El alumno intentó copiar/pegar',
            'GAZE_DEVIATION': 'Se detectó desviación de la mirada del alumno',
        };

        const payload: BackendInfraccionPayload = {
            id_sesion: Number(this.remoteSessionId),
            minuto_infraccion: minuteStr,
            tipo_infraccion: tipoInfraccion,
            detalles_infraccion: detallesMap[trigger] || `Infracción detectada: ${trigger}`,
            url_azure_evidencia: null,
        };

        try {
            await fetch(`${this.apiUrl}/monitoreo/infracciones`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.authToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload),
                keepalive: true
            });
            this.logger('success', `📤 Infracción registrada: ${tipoInfraccion} (${minuteStr})`);
             } catch (err) {
                 this.logger('info', '📥 Infracción encolada offline');
 
                 this.queue.enqueueJson(
                     `${this.apiUrl}/monitoreo/infracciones`,
                     payload
                 );
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

        // Timeout de 10s para que el spinner no quede colgado si el servidor no responde
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10_000);

        try {
            const metaPayload = { usuario_id: userId };
            const formData = new FormData();
            formData.append('meta', JSON.stringify(metaPayload));
            formData.append('file', photo);

            this.logger('info', `🔍 [Biométrico] Enviando validación`, {
                url,
                metaPayload,
                photoSize: `${photo.size} bytes`,
                photoType: photo.type,
            });

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.authToken}`
                },
                body: formData,
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (response.ok) {
                this.logger('success', '✅ Validación biométrica exitosa');
                return true;
            } else {
                const body = await response.json().catch(() => ({}));
                this.logger('error', `❌ Validación biométrica fallida (${response.status})`, body);
                return false;
            }
        } catch (err: unknown) {
             clearTimeout(timeoutId);
             if (err instanceof Error && err?.name === 'AbortError') {
                 this.logger('error', '⏱️ Timeout: el servidor tardó más de 10s en responder la validated biométrica');
             } else {
                 this.logger('error', '❌ Error de red al validar biometría', err);
             }
             return false;
         }
     }
 }
