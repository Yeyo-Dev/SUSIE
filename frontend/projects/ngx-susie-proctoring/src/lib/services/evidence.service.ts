import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, firstValueFrom } from 'rxjs';
import { EvidenceQueueService } from './evidence-queue.service';
import { DestroyRefUtility } from '@lib/utils/destroy-ref.utility';
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
} from '@lib/models/contracts';

@Injectable({ providedIn: 'root' })
export class EvidenceService {
    private readonly http = inject(HttpClient);
    
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

        // Inicializar cola offline
        this.queue.setLogger(this.logger);
        this.queue.init();
    }

    setLogger(fn: LoggerFn) {
        this.logger = fn;
    }

    /** Obtiene el ID de sesión remota (solo disponible después de startSession). */
    getRemoteSessionId(): string | null {
        return this.remoteSessionId;
    }

    private shouldRestartAudio = false;

    sendEvent(payload: Partial<EvidenceMetadata['_internal']> & { file?: Blob }) {
        const { file, ...restPayload } = payload;

        // Construir el objeto meta alineado con el contrato del backend
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
                // Los eventos de browser y focus lost no coinciden con el patrón multipart.
                // Retornar un valor por defecto; uploadEvidence maneja el routing.
                return { type: 'snapshot_webcam', source: 'web' };
        }
    }


    startAudioRecording(stream: MediaStream | null, config: AudioRecordingConfig) {
        if (!stream) {
            this.logger('error', '❌ No hay stream de audio disponible para grabar');
            return;
        }
        this.stopAudioRecording(); // Limpia timers previos si se llama doble accidentalmente
        this.shouldRestartAudio = true;
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
                // Ignorar blobs vacíos o diminutos (ej: solo headers) de stop/starts rápidos
                if (event.data && event.data.size > 200) {
                    this.sendAudioChunk(event.data);
                }
            };

            this.mediaRecorder.onstop = () => {
                if (this.shouldRestartAudio && this.mediaRecorder) {
                    try {
                        this.mediaRecorder.start();
                    } catch (e) {
                        this.logger('error', '❌ Error al reiniciar MediaRecorder', e);
                    }
                }
            };

            this.mediaRecorder.onerror = (event: Event) => {
                const error = (event as any).error;
                this.logger('error', '❌ Error en MediaRecorder', error);
            };

            // Se suma un pequeño offset para asegurar que el reproductor
            // marque el tiempo completo (ej: 15s redondos en vez de 14.8s)
            const interval = ((config.chunkIntervalSeconds || 15) * 1000) + 500;

            this.mediaRecorder.start();

            this.recordingInterval = this.cleanup.setInterval(() => {
                if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
                    this.mediaRecorder.stop();
                }
            }, interval);

            this.logger('success', `🎙️ Grabación de audio por bloques iniciada (${mimeType})`, { interval });

        } catch (err: unknown) {
            this.logger('error', '❌ Falló al iniciar MediaRecorder', err);
        }
    }

    stopAudioRecording() {
        this.shouldRestartAudio = false;
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
        // apiUrl ya incluye el prefijo /susie/api/v1 (configurado por ExamConfigService)
        const url = `${this.apiUrl}/sesiones`;
        const assignmentId = this.sessionContext.assignmentId;

        if (!assignmentId) {
            this.logger('error', '⚠️ No hay assignmentId (id_asignacion) configurado. No se puede crear sesión.');
            return null;
        }

        try {
            const sesion = await firstValueFrom(
                this.http.post<BackendSesionResponse>(url, { id_asignacion: Number(assignmentId) })
            );

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
     * Usa PATCH /sesiones/finalizar/:id_sesion.
     */
    async endSession(status: 'submitted' | 'cancelled'): Promise<void> {
        if (!this.apiUrl || !this.remoteSessionId) return;
        // apiUrl ya incluye el prefijo /susie/api/v1
        const url = `${this.apiUrl}/sesiones/finalizar/${this.remoteSessionId}`;
        
        try {
            await firstValueFrom(
                this.http.patch(url, {})
            );
            this.logger('success', `🔴 Sesión de examen finalizada (${status}, id_sesion: ${this.remoteSessionId})`);
        } catch (error) {
            this.logger('error', '⚠️ Falló el registro de fin de sesión en el servidor');
        }
    }


    private async uploadEvidence(data: EvidencePayload) {
        if (!this.apiUrl) return;

        const internalType = data.metadata?._internal?.type;

        // Determinar endpoint según el tipo de evidenciatype EvidencePayload
        let endpointUrl = '';

        if (internalType === 'AUDIO_CHUNK') {
            // apiUrl ya incluye el prefijo /susie/api/v1
            endpointUrl = `${this.apiUrl}/monitoreo/evidencias/audios`;
            // Inyectar fragmento_indice en meta
            data.metadata.meta.fragmento_indice = this.audioFragmentIndex;
        } else if (internalType === 'SNAPSHOT') {
            // apiUrl ya incluye el prefijo /susie/api/v1
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
            // NOTA: NO establecer Content-Type manualmente - HttpClient maneja el boundary
            const formData = new FormData();
            formData.append('meta', JSON.stringify(data.metadata.meta));
            formData.append('payload_info', JSON.stringify(data.metadata.payload_info));

            if (data.file) {
                formData.append('file', data.file);
            }

            await firstValueFrom(
                this.http.post(endpointUrl, formData).pipe(
                    catchError((err) => {
                        this.logger('info', `📥 Evidencia encolada offline (red no disponible)`);
                        
                        // Persistir en IndexedDB para reintentar cuando la red se recupere
                        this.queue.enqueueMultipart(
                            endpointUrl,
                            data.metadata.meta,
                            data.metadata.payload_info,
                            data.file
                        );
                        
                        // Retornar vacío para que el flujo continúe
                        return [];
                    })
                )
            );

            if (data.file) {
                const isAudio = internalType === 'AUDIO_CHUNK';
                const label = isAudio ? 'Audio (15s)' : 'Snapshot';
                this.logger('success', `📤 ${label} enviado al servidor (${data.file.size} bytes)`);
            }

        } catch (err) {
            // Este catch es para errores no manejados por catchError
            this.logger('error', '⚠️ Error inesperado en uploadEvidence', err);
        }
    }

    /**
     * Envía las coordenadas de la mirada al endpoint del backend para generar mapas de calor.
     * Payload alineado al contrato: { sesion_id, timestamp ISO, gaze_points }.
     */
    async sendGazeData(points: { x: number, y: number }[]): Promise<void> {
        if (!this.remoteSessionId || !this.apiUrl) {
            return;
        }

        // apiUrl ya incluye el prefijo /susie/api/v1
        const url = `${this.apiUrl}/monitoreo/evidencias/gaze_tracking`;
        const payload = {
            sesion_id: Number(this.remoteSessionId),
            timestamp: new Date().toISOString(),
            gaze_points: points.map(p => ({ x: p.x, y: p.y }))
        };

        try {
            await firstValueFrom(
                this.http.post(url, payload).pipe(
                    catchError((err) => {
                        this.logger('info', '📥 Datos de gaze tracking encolados offline');
                        this.queue.enqueueJson(url, payload);
                        return [];
                    })
                )
            );
            this.logger('success', `📤 Datos de seguimiento ocular enviados (${points.length} puntos)`);
        } catch (err) {
            this.logger('error', '⚠️ Error inesperado en sendGazeData', err);
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
            'NETWORK_TIMEOUT': 'OTRO',
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
            'NETWORK_TIMEOUT': 'Timeout de conexión de red - no se pudo restablecer conexión',
        };

        const payload: BackendInfraccionPayload = {
            id_sesion: Number(this.remoteSessionId),
            minuto_infraccion: minuteStr,
            tipo_infraccion: tipoInfraccion,
            detalles_infraccion: detallesMap[trigger] || `Infracción detectada: ${trigger}`,
            url_azure_evidencia: null,
        };

        // apiUrl ya incluye el prefijo /susie/api/v1
        const url = `${this.apiUrl}/monitoreo/infracciones`;

        try {
            await firstValueFrom(
                this.http.post(url, payload).pipe(
                    catchError((err) => {
                        this.logger('info', '📥 Infracción encolada offline');
                        this.queue.enqueueJson(url, payload);
                        return [];
                    })
                )
            );
            this.logger('success', `📤 Infracción registrada: ${tipoInfraccion} (${minuteStr})`);
        } catch (err) {
            this.logger('error', '⚠️ Error inesperado en sendInfraccion', err);
        }
    }

    /**
     * Valida la identidad del candidato enviando su foto al endpoint
     * dedicado de biometría del backend.
     * El backend devuelve { status, message, data } — se considera exitoso si status === 'success'.
     * @returns true si la validación fue exitosa (HTTP 200 y status === 'success'), false en caso contrario.
     */
    async validateBiometric(photo: Blob, userId: string | number): Promise<boolean> {
        if (!this.apiUrl) {
            this.logger('error', '⚠️ No hay API URL configurada para validación biométrica');
            return false;
        }

        // apiUrl ya incluye el prefijo /susie/api/v1
        const url = `${this.apiUrl}/usuarios/biometricos/validar`;

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

        try {
            const response = await firstValueFrom(
                this.http.post<{ status: string; message: string; data?: unknown }>(url, formData).pipe(
                    catchError((err) => {
                        if (err.status === 0) {
                            this.logger('error', '⏱️ Timeout: el servidor tardó más de 10s en responder la validated biométrica');
                        } else {
                            this.logger('error', '❌ Error de red al validar biometría', err);
                        }
                        return [];
                    })
                )
            );

            // Backend devuelve { status, message, data } — exitoso solo si status === 'success'
            if (response?.status === 'success') {
                this.logger('success', `✅ Validación biométrica exitosa: ${response.message}`);
                return true;
            } else {
                this.logger('error', `❌ Validación biométrica fallida: ${response?.message ?? 'respuesta inválida'}`);
                return false;
            }
        } catch (err) {
            // Error ya manejado por catchError
            return false;
        }
    }
}
