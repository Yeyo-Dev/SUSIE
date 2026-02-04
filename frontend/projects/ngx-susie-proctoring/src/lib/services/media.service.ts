import { Injectable, signal, computed } from '@angular/core';

@Injectable({
    providedIn: 'root'
})
export class MediaService {
    // Estado reactivo con Signals
    private streamSignal = signal<MediaStream | null>(null);
    private errorSignal = signal<string | null>(null);

    // Selectores de solo lectura
    readonly stream = this.streamSignal.asReadonly();
    readonly error = this.errorSignal.asReadonly();
    readonly isActive = computed(() => !!this.streamSignal());

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

    private handleError(error: unknown): void {
        let errorMessage = 'Error desconocido al acceder a la cámara/micrófono.';

        if (error instanceof DOMException) {
            switch (error.name) {
                case 'NotAllowedError':
                    errorMessage = 'Permiso denegado. Por favor permite el acceso a la cámara.';
                    break;
                case 'NotFoundError':
                    errorMessage = 'No se encontró ningún dispositivo de cámara o micrófono.';
                    break;
                case 'NotReadableError':
                    errorMessage = 'La cámara está siendo usada por otra aplicación.';
                    break;
            }
        }

        console.error('MediaService Error:', error);
        this.errorSignal.set(errorMessage);
    }
}
