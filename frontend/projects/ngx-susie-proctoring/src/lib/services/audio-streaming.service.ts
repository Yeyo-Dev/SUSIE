import { Injectable, signal, computed } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({
    providedIn: 'root'
})
export class AudioStreamingService {
    private mediaRecorder: MediaRecorder | null = null;
    private socket: WebSocket | null = null;

    // Signals para estado reactivo
    private isRecordingSignal = signal<boolean>(false);
    private errorSignal = signal<string | null>(null);

    // Eventos para el debug panel
    private chunkSentSubject = new Subject<{ size: number, timestamp: number }>();

    readonly isRecording = this.isRecordingSignal.asReadonly();
    readonly error = this.errorSignal.asReadonly();
    readonly chunkSent$ = this.chunkSentSubject.asObservable();

    connect(url: string, queryParams: any): void {
        const queryString = new URLSearchParams(queryParams).toString();
        const wsUrl = `${url}?${queryString}`;

        this.socket = new WebSocket(wsUrl);

        this.socket.onopen = () => {
            console.log('WebSocket Audio Connected');
            this.errorSignal.set(null);
        };

        this.socket.onerror = (err) => {
            console.error('WebSocket Error:', err);
            this.errorSignal.set('Error en conexión de audio');
            this.isRecordingSignal.set(false);
        };

        this.socket.onclose = () => {
            console.log('WebSocket Closed');
            this.isRecordingSignal.set(false);
        };
    }

    startRecording(stream: MediaStream): void {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
            this.errorSignal.set('No hay conexión con el servidor de audio');
            return;
        }

        try {
            // Usamos el mimeType correcto para el backend (espera ogg/webm)
            // Chrome usa webm/opus por defecto
            const options = { mimeType: 'audio/webm;codecs=opus' };

            this.mediaRecorder = new MediaRecorder(stream, options);

            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0 && this.socket?.readyState === WebSocket.OPEN) {
                    this.socket.send(event.data);
                    this.chunkSentSubject.next({
                        size: event.data.size,
                        timestamp: Date.now()
                    });
                }
            };

            this.mediaRecorder.onstart = () => this.isRecordingSignal.set(true);
            this.mediaRecorder.onstop = () => this.isRecordingSignal.set(false);
            this.mediaRecorder.onerror = (err) => {
                console.error('MediaRecorder Error:', err);
                this.errorSignal.set('Error en grabación de audio');
            };

            // Enviamos chunks cada 15 segundos (15000ms)
            this.mediaRecorder.start(15000);

        } catch (err) {
            console.error('Error al iniciar MediaRecorder:', err);
            this.errorSignal.set('No se pudo iniciar la grabación');
        }
    }

    stopRecording(): void {
        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
            this.mediaRecorder.stop();
        }
    }

    disconnect(): void {
        this.stopRecording();
        if (this.socket) {
            this.socket.close();
            this.socket = null;
        }
    }
}
