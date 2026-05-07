import { Injectable, signal, inject } from '@angular/core';
import { DestroyRefUtility } from '@lib/utils/destroy-ref.utility';
import { LoggerFn, IntervalHandle } from '@lib/models/contracts';

// ── Wire format: lo que el backend REALMENTE envía por WebSocket ──

/** Tipos de infracción que el backend puede enviar en el payload. */
type BackendInfraccionTipoWs = 'CAMBIO_DE_PESTAÑA' | 'USO_DE_TELEFONO' | 'OTRO';

/** Mensaje de conexión exitosa: { tipo: 'CONECTADO_WS', mensaje: '...' } */
interface BackendWsConectado {
    tipo: 'CONECTADO_WS';
    mensaje: string;
}

/** Alerta de infracción: { tipo: 'ALERTA_INFRACCION', payload: {...} } */
interface BackendWsAlerta {
    tipo: 'ALERTA_INFRACCION';
    payload: {
        sesion_id?: number;
        minuto_infraccion?: string;
        tipo_infraccion?: BackendInfraccionTipoWs;
        detalles_infraccion?: string;
        url_azure_evidencia?: string | null;
    };
}

/** Union de todos los mensajes posibles del backend vía WS. */
type BackendWsMessage = BackendWsConectado | BackendWsAlerta;

// ── UI format: lo que los componentes consumen vía currentAlert ──

/**
 * Alerta transformada para la UI.
 * Los componentes leen `type` para elegir estilo y `msg` para mostrar texto.
 */
export interface AIAlertPayload {
    /** Severidad visual: WARNING, CRITICAL, INFO */
    type: 'WARNING' | 'CRITICAL' | 'INFO';
    /** Mensaje descriptivo para mostrar al usuario */
    msg: string;
    /** Timestamp ISO del evento (opcional) */
    timestamp?: string;
    /** Datos adicionales opcionales del payload original */
    payload?: Record<string, unknown>;
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

    private logger: LoggerFn = () => { };

    setLogger(fn: LoggerFn) {
        this.logger = fn;
    }

    /**
     * Abre la conexión WebSocket hacia el endpoint de infracciones del backend.
     * @param wsUrl URL base del WebSocket (ej. ws://localhost:3000)
     * @param sessionId ID de la sesión de examen para suscribirse
     * Endpoint: /monitoreo/infracciones/ws/:id_sesion
     */
    connect(wsUrl: string, sessionId: string) {
        if (this.socket) {
            this.logger('info', '🔌 WebSocket de feedback ya estaba conectado, cerrando anterior...');
            this.disconnect();
        }

        this.intentionalClose = false;
        this.reconnectAttempts = 0;

        // WS path: /monitoreo/infracciones/ws/:id_sesion
        const url = `${wsUrl}/monitoreo/infracciones/ws/${encodeURIComponent(sessionId)}`;
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
            const raw: BackendWsMessage = JSON.parse(data);

            // Mensaje de conexión exitosa → solo log, no se muestra al usuario
            if (raw.tipo === 'CONECTADO_WS') {
                this.logger('success', `🔌 WS conectado: ${raw.mensaje}`);
                return;
            }

            // Alerta de infracción → transformar a formato UI
            if (raw.tipo === 'ALERTA_INFRACCION' && raw.payload) {
                const alert = this.mapBackendAlertToUI(raw.payload);
                this.logger('info', `⚠️ Alerta de IA recibida: [${alert.type}] ${alert.msg}`);
                this.showAlert(alert);
                return;
            }

            // Mensaje desconocido — ignorar silenciosamente
            this.logger('info', `ℹ️ Mensaje WS no reconocido (tipo: ${(raw as any).tipo})`);
        } catch {
            this.logger('error', '❌ Mensaje de feedback no es JSON válido', data);
        }
    }

    /**
     * Transforma el payload de infracción del backend al formato AIAlertPayload para la UI.
     * Mapea tipo_infraccion → severidad visual y detalles_infraccion → mensaje.
     */
    private mapBackendAlertToUI(payload: BackendWsAlerta['payload']): AIAlertPayload {
        // Mapear severidad: USO_DE_TELEFONO es crítico, el resto es warning
        const severityMap: Record<string, AIAlertPayload['type']> = {
            'USO_DE_TELEFONO': 'CRITICAL',
            'CAMBIO_DE_PESTAÑA': 'WARNING',
            'OTRO': 'WARNING',
        };

        const tipo = payload.tipo_infraccion ?? 'OTRO';

        return {
            type: severityMap[tipo] ?? 'WARNING',
            msg: payload.detalles_infraccion ?? `Infracción detectada: ${tipo}`,
            timestamp: new Date().toISOString(),
            payload: payload as unknown as Record<string, unknown>,
        };
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
