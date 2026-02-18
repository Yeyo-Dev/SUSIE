import { Injectable, signal, computed } from '@angular/core';

@Injectable({
    providedIn: 'root'
})
export class MediaService {
    // Estado reactivo con Signals
    private streamSignal = signal<MediaStream | null>(null);
    private errorSignal = signal<string | null>(null);
    private mediaRecorderSignal = signal<MediaRecorder | null>(null);
    private isRecordingSignal = signal<boolean>(false);

    // Selectores de solo lectura
    readonly stream = this.streamSignal.asReadonly();
    readonly error = this.errorSignal.asReadonly();
    readonly isActive = computed(() => !!this.streamSignal());
    readonly audioRecordingActive = this.isRecordingSignal.asReadonly();

    async startStream(video: boolean = true, audio: boolean = true): Promise<void> {
        try {
            this.errorSignal.set(null);

            const constraints: MediaStreamConstraints = {
                video: video ? {
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    facingMode: 'user'
                } : false,
                audio: audio
            };

            const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
            this.streamSignal.set(mediaStream);

        } catch (err) {
            this.handleError(err);
            throw err; // Re-lanzar para que el componente lo maneje si es necesario
        }
    }

    stopStream(): void {
        const currentStream = this.streamSignal();
        if (currentStream) {
            currentStream.getTracks().forEach((track: MediaStreamTrack) => track.stop());
            this.streamSignal.set(null);
        }
    }

    /**
     * Captura un frame del video actual y lo retorna como Blob.
     * Utiliza un canvas off-screen para optimización.
     */
    async takeSnapshot(videoElement: HTMLVideoElement): Promise<Blob | null> {
        if (!this.streamSignal() || !videoElement) return null;

        const canvas = document.createElement('canvas');
        canvas.width = videoElement.videoWidth;
        canvas.height = videoElement.videoHeight;

        const ctx = canvas.getContext('2d');
        if (!ctx) return null;

        ctx.drawImage(videoElement, 0, 0);

        return new Promise((resolve) => {
            canvas.toBlob((blob) => {
                resolve(blob);
            }, 'image/jpeg', 0.85); // Calidad JPEG al 85% para balancear tamaño/calidad
        });
    }

    /**
     * Inicia la grabación de audio usando MediaRecorder API.
     * @param onChunk Callback que se ejecuta cada vez que hay un chunk de audio disponible
     * @param chunkIntervalMs Intervalo en milisegundos para generar chunks (default: 10000ms = 10s)
     */
    async startAudioRecording(
        onChunk: (blob: Blob) => void,
        chunkIntervalMs: number = 10000
    ): Promise<void> {
        try {
            const currentStream = this.streamSignal();

            if (!currentStream) {
                throw new Error('No hay stream de medios disponible. Llama a startStream() primero.');
            }

            // Verificar que el stream tenga pistas de audio
            const audioTracks = currentStream.getAudioTracks();
            if (audioTracks.length === 0) {
                throw new Error('El stream no contiene pistas de audio. Asegúrate de habilitar audio en startStream().');
            }

            // Verificar soporte de MediaRecorder
            if (!window.MediaRecorder) {
                throw new Error('MediaRecorder API no está soportada en este navegador.');
            }

            // Configurar opciones de MediaRecorder
            const options: MediaRecorderOptions = {
                mimeType: this.getSupportedMimeType(),
                audioBitsPerSecond: 32000 // 32 kbps - suficiente para voz
            };

            const mediaRecorder = new MediaRecorder(currentStream, options);

            // Manejar evento de datos disponibles
            mediaRecorder.ondataavailable = (event: BlobEvent) => {
                if (event.data && event.data.size > 0) {
                    console.log(`Audio chunk capturado: ${event.data.size} bytes`);
                    onChunk(event.data);
                }
            };

            // Manejar errores
            mediaRecorder.onerror = (event: Event) => {
                console.error('Error en MediaRecorder:', event);
                this.errorSignal.set('Error durante la grabación de audio.');
                this.isRecordingSignal.set(false);
            };

            // Manejar evento de parada
            mediaRecorder.onstop = () => {
                console.log('Grabación de audio detenida');
                this.isRecordingSignal.set(false);
            };

            // Iniciar grabación con timeslice para generar chunks periódicos
            mediaRecorder.start(chunkIntervalMs);

            this.mediaRecorderSignal.set(mediaRecorder);
            this.isRecordingSignal.set(true);

            console.log(`Grabación de audio iniciada (chunks cada ${chunkIntervalMs}ms)`);

        } catch (err) {
            this.handleError(err);
            throw err;
        }
    }

    /**
     * Detiene la grabación de audio.
     */
    stopAudioRecording(): void {
        const recorder = this.mediaRecorderSignal();

        if (recorder && recorder.state !== 'inactive') {
            recorder.stop();
            this.mediaRecorderSignal.set(null);
            this.isRecordingSignal.set(false);
            console.log('Grabación de audio detenida manualmente');
        }
    }

    /**
     * Obtiene el tipo MIME soportado por el navegador para audio.
     * Prioriza WebM/Opus, luego WebM, luego cualquier formato disponible.
     */
    private getSupportedMimeType(): string {
        const types = [
            'audio/webm;codecs=opus',
            'audio/webm',
            'audio/ogg;codecs=opus',
            'audio/mp4'
        ];

        for (const type of types) {
            if (MediaRecorder.isTypeSupported(type)) {
                console.log(`Usando formato de audio: ${type}`);
                return type;
            }
        }

        // Fallback: dejar que el navegador elija
        console.warn('No se encontró un tipo MIME preferido, usando default del navegador');
        return '';
    }

    private handleError(error: unknown): void {
        let errorMessage = 'Error desconocido al acceder a la cámara/micrófono.';

        if (error instanceof DOMException) {
            switch (error.name) {
                case 'NotAllowedError':
                    errorMessage = 'Permiso denegado. Por favor permite el acceso a la cámara/micrófono.';
                    break;
                case 'NotFoundError':
                    errorMessage = 'No se encontró ningún dispositivo de cámara o micrófono.';
                    break;
                case 'NotReadableError':
                    errorMessage = 'La cámara/micrófono está siendo usada por otra aplicación.';
                    break;
            }
        } else if (error instanceof Error) {
            errorMessage = error.message;
        }

        console.error('MediaService Error:', error);
        this.errorSignal.set(errorMessage);
    }
}

