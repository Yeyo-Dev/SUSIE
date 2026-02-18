import { Injectable, signal, OnDestroy } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class MediaService implements OnDestroy {
    stream = signal<MediaStream | null>(null);
    error = signal<string | null>(null);

    // Almacena el stream de audio, podría ser el mismo que el de video si se piden ambos
    private audioStream: MediaStream | null = null;

    async requestPermissions(video: boolean, audio: boolean): Promise<void> {
        this.error.set(null);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video,
                audio
            });
            this.stream.set(stream);

            // Si hay audio track, lo guardamos o extraemos
            if (audio) {
                this.audioStream = stream;
            }
        } catch (err: any) {
            let msg = 'Error desconocido al acceder a dispositivos.';
            if (err.name === 'NotAllowedError') {
                msg = 'Permiso denegado. Por favor permite el acceso a la cámara y micrófono.';
            } else if (err.name === 'NotFoundError') {
                msg = 'No se encontraron dispositivos de cámara o micrófono.';
            } else if (err.name === 'NotReadableError') {
                msg = 'El dispositivo está siendo usado por otra aplicación.';
            }
            this.error.set(msg);
            throw err;
        }
    }

    getAudioStream(): MediaStream | null {
        return this.audioStream;
    }

    stop() {
        const s = this.stream();
        if (s) {
            s.getTracks().forEach(track => track.stop());
            this.stream.set(null);
        }
        this.audioStream = null;
    }

    ngOnDestroy() {
        this.stop();
    }
}
