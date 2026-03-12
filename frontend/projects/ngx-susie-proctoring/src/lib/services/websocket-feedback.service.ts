import { Injectable, signal, inject } from '@angular/core';
import { DestroyRefUtility } from '../utils/destroy-ref.utility';

/**
 * Estructura del payload JSON que el backend envía a través del WebSocket.
 */
export interface AIAlertPayload {
    type: 'WARNING' | 'CRITICAL' | 'INFO';
    msg: string;
    timestamp?: string;
}

/**
 * Servicio que mantiene una conexión WebSocket dedicada exclusivamente para
 * recibir alertas de feedback de la IA del backend (YOLO, Whisper, etc.)
 * durante la fase de monitoreo del examen.
 *
 * No envía datos al servidor — solo escucha.
 */
@Injectable({ providedIn: 'root' })
export class WebSocketFeedbackService {

    /** Alerta activa actual (null = sin alerta visible) */
    currentAlert = signal<AIAlertPayload | null>(null);

    private socket: WebSocket | null = null;
    private dismissTimer: ReturnType<typeof setTimeout> | null = null;
    private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    private reconnectAttempts = 0;
    private intentionalClose = false;
    private cleanup = inject(DestroyRefUtility);

    /** Duración en ms de la alerta visible antes de auto-descartarse */
    private readonly ALERT_DURATION_MS = 6000;
    /** Máximo de intentos de reconexión antes de rendirse */
    private readonly MAX_RECONNECT_ATTEMPTS = 8;

    private logger: (type: 'info' | 'error' | 'success', msg: string, details?: any) => void = () => { };

    setLogger(fn: (type: 'info' | 'error' | 'success', msg: string, details?: any) => void) {
        this.logger = fn;
    }

    /**
     * Abre la conexión WebSocket hacia el endpoint de feedback del backend.
     * @param wsUrl URL base del WebSocket (ej. ws://localhost:3000)
     * @param sessionId ID de la sesión de examen para suscribirse
     */
    connect(wsUrl: string, sessionId: string) {
        if (this.socket) {
            this.logger('info', '🔌 WebSocket de feedback ya estaba conectado, cerrando anterior...');
            this.disconnect();
        }

        this.intentionalClose = false;
        this.reconnectAttempts = 0;

        const url = `${wsUrl}/monitoreo/feedback?session_id=${encodeURIComponent(sessionId)}`;
        this.logger('info', `📡 Conectando WebSocket de feedback: ${url}`);

        this.initSocket(url);
    }

    /**
     * Cierra la conexión WebSocket limpiamente.
     */
    disconnect() {
        this.intentionalClose = true;
        this.clearTimers();

        if (this.socket) {
            this.socket.close(1000, 'Exam session ended');
            this.socket = null;
        }

        this.currentAlert.set(null);
        this.reconnectAttempts = 0;
        this.logger('info', '🔌 WebSocket de feedback desconectado');
    }

    private initSocket(url: string) {
        try {
            this.socket = new WebSocket(url);

            this.socket.onopen = () => {
                this.logger('success', '✅ WebSocket de feedback conectado');
                this.reconnectAttempts = 0;
            };

            this.socket.onmessage = (event: MessageEvent) => {
                this.handleMessage(event.data);
            };

            this.socket.onerror = (err) => {
                this.logger('error', '❌ Error en WebSocket de feedback', err);
            };

            this.socket.onclose = (event: CloseEvent) => {
                this.logger('info', `🔌 WebSocket cerrado (código: ${event.code})`);
                this.socket = null;

                if (!this.intentionalClose) {
                    this.scheduleReconnect(url);
                }
            };
        } catch (err) {
            this.logger('error', '❌ No se pudo crear WebSocket de feedback', err);
        }
    }

    private handleMessage(data: string) {
        try {
            const payload: AIAlertPayload = JSON.parse(data);

            if (payload && payload.msg) {
                this.logger('info', `⚠️ Alerta de IA recibida: [${payload.type}] ${payload.msg}`);
                this.showAlert(payload);
            }
        } catch {
            this.logger('error', '❌ Mensaje de feedback no es JSON válido', data);
        }
    }

    private showAlert(payload: AIAlertPayload) {
        // Limpiar timer anterior si había una alerta activa
        if (this.dismissTimer) {
            this.cleanup.clearTimeout(this.dismissTimer);
        }

        this.currentAlert.set(payload);

        // Auto-descartar después de N segundos
        this.dismissTimer = this.cleanup.setTimeout(() => {
            this.currentAlert.set(null);
            this.dismissTimer = null;
        }, this.ALERT_DURATION_MS);
    }

    private scheduleReconnect(url: string) {
        if (this.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
            this.logger('error', '❌ Se agotaron los reintentos de reconexión de feedback');
            return;
        }

        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000); // Max 30s
        this.reconnectAttempts++;

        this.logger('info', `🔄 Reintentando conexión de feedback en ${delay / 1000}s (intento ${this.reconnectAttempts}/${this.MAX_RECONNECT_ATTEMPTS})`);

        this.reconnectTimer = this.cleanup.setTimeout(() => {
            this.initSocket(url);
        }, delay);
    }

    private clearTimers() {
        if (this.dismissTimer) {
            this.cleanup.clearTimeout(this.dismissTimer);
            this.dismissTimer = null;
        }
        if (this.reconnectTimer) {
            this.cleanup.clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
    }
}
