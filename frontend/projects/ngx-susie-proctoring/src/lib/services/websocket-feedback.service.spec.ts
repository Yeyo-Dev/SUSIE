import { TestBed, fakeAsync, tick, discardPeriodicTasks } from '@angular/core/testing';
import { WebSocketFeedbackService, AIAlertPayload } from './websocket-feedback.service';

// ══════════════════════════════════════════════════════════════
// Mock WebSocket para sustituir el constructor nativo
// ══════════════════════════════════════════════════════════════

class MockWebSocket {
    static lastInstance: MockWebSocket | null = null;

    url: string;
    onopen: ((ev: Event) => void) | null = null;
    onmessage: ((ev: MessageEvent) => void) | null = null;
    onerror: ((ev: Event) => void) | null = null;
    onclose: ((ev: CloseEvent) => void) | null = null;
    readyState = 0; // CONNECTING
    closedWith: { code?: number; reason?: string } | null = null;

    constructor(url: string) {
        this.url = url;
        MockWebSocket.lastInstance = this;
    }

    close(code?: number, reason?: string) {
        this.closedWith = { code, reason };
        this.readyState = 3; // CLOSED
    }

    // Helpers para simular eventos desde los tests
    simulateOpen() {
        this.readyState = 1; // OPEN
        this.onopen?.(new Event('open'));
    }

    simulateMessage(data: string) {
        this.onmessage?.({ data } as MessageEvent);
    }

    simulateClose(code = 1006) {
        this.readyState = 3;
        const event = new CloseEvent('close', { code });
        this.onclose?.(event);
    }

    simulateError() {
        this.onerror?.(new Event('error'));
    }
}

describe('WebSocketFeedbackService', () => {
    let service: WebSocketFeedbackService;
    let originalWebSocket: typeof WebSocket;

    beforeEach(() => {
        // Sustituir el constructor global de WebSocket
        originalWebSocket = globalThis.WebSocket;
        (globalThis as any).WebSocket = MockWebSocket as any;
        MockWebSocket.lastInstance = null;

        TestBed.configureTestingModule({
            providers: [WebSocketFeedbackService],
        });

        service = TestBed.inject(WebSocketFeedbackService);
    });

    afterEach(() => {
        service.disconnect();
        // Restaurar WebSocket nativo
        (globalThis as any).WebSocket = originalWebSocket;
    });

    // ══════════════════════════════════════════════════════════════
    // 2.2  Connection URL correctness
    // ══════════════════════════════════════════════════════════════

    describe('connect() — Connection', () => {

        it('debe construir la URL del WebSocket con el sessionId codificado', () => {
            service.connect('ws://localhost:3000', 'session-42');

            expect(MockWebSocket.lastInstance).toBeTruthy();
            expect(MockWebSocket.lastInstance!.url).toBe(
                'ws://localhost:3000/monitoreo/feedback?session_id=session-42'
            );
        });

        it('debe resetear el contador de reintentos al conectar exitosamente', fakeAsync(() => {
            service.connect('ws://localhost:3000', '1');
            const socket = MockWebSocket.lastInstance!;
            socket.simulateOpen();

            // Forzar un cierre inesperado para que intente reconectar
            socket.simulateClose();

            // Ahora reconectamos manualmente
            service.connect('ws://localhost:3000', '2');
            const newSocket = MockWebSocket.lastInstance!;
            newSocket.simulateOpen();

            // Si se vuelve a cerrar, el delay debe ser el mínimo (1s) — no acumulado
            newSocket.simulateClose();
            // El primer reintento debe programarse con delay de 1s (2^0 * 1000)
            tick(1100);
            expect(MockWebSocket.lastInstance).not.toBe(newSocket);

            // Limpiar timers pendientes
            service.disconnect();
            discardPeriodicTasks();
        }));

        it('debe cerrar la conexión anterior si ya existía una al llamar connect()', () => {
            service.connect('ws://localhost:3000', 'first');
            const firstSocket = MockWebSocket.lastInstance!;
            firstSocket.simulateOpen();

            // Segunda conexión
            service.connect('ws://localhost:3000', 'second');

            // La primera conexión debe haberse cerrado
            expect(firstSocket.closedWith).toBeTruthy();
        });
    });

    // ══════════════════════════════════════════════════════════════
    // 2.3  Valid JSON payload → signal update
    // ══════════════════════════════════════════════════════════════

    describe('Incoming Messages', () => {

        it('debe actualizar currentAlert con un payload WARNING válido', () => {
            service.connect('ws://localhost:3000', '1');
            const socket = MockWebSocket.lastInstance!;
            socket.simulateOpen();

            const payload: AIAlertPayload = {
                type: 'WARNING',
                msg: 'Persona adicional detectada en cámara',
            };

            socket.simulateMessage(JSON.stringify(payload));

            expect(service.currentAlert()).toEqual(
                jasmine.objectContaining({ type: 'WARNING', msg: 'Persona adicional detectada en cámara' })
            );
        });

        it('debe actualizar currentAlert con un payload CRITICAL válido', () => {
            service.connect('ws://localhost:3000', '1');
            const socket = MockWebSocket.lastInstance!;
            socket.simulateOpen();

            const payload: AIAlertPayload = {
                type: 'CRITICAL',
                msg: 'Posible suplantación de identidad',
            };

            socket.simulateMessage(JSON.stringify(payload));

            expect(service.currentAlert()).toEqual(
                jasmine.objectContaining({ type: 'CRITICAL' })
            );
        });

        // ──────────────────────────────────────────────────────────
        // 2.4  Invalid JSON payload → no crash
        // ──────────────────────────────────────────────────────────

        it('NO debe actualizar currentAlert cuando el mensaje no es JSON válido', () => {
            service.connect('ws://localhost:3000', '1');
            const socket = MockWebSocket.lastInstance!;
            socket.simulateOpen();

            // Enviar basura
            socket.simulateMessage('this-is-not-json!!!');

            expect(service.currentAlert()).toBeNull();
        });

        it('NO debe actualizar currentAlert cuando el JSON no tiene campo msg', () => {
            service.connect('ws://localhost:3000', '1');
            const socket = MockWebSocket.lastInstance!;
            socket.simulateOpen();

            socket.simulateMessage(JSON.stringify({ type: 'INFO' }));

            expect(service.currentAlert()).toBeNull();
        });
    });

    // ══════════════════════════════════════════════════════════════
    // 2.5  Auto-dismiss after 6000ms
    // ══════════════════════════════════════════════════════════════

    describe('Auto-dismiss', () => {

        it('debe limpiar currentAlert después de 6000ms', fakeAsync(() => {
            service.connect('ws://localhost:3000', '1');
            const socket = MockWebSocket.lastInstance!;
            socket.simulateOpen();

            socket.simulateMessage(JSON.stringify({ type: 'WARNING', msg: 'Test' }));
            expect(service.currentAlert()).not.toBeNull();

            // Adelantar 5999ms — aún visible
            tick(5999);
            expect(service.currentAlert()).not.toBeNull();

            // El milisegundo faltante
            tick(1);
            expect(service.currentAlert()).toBeNull();
        }));

        it('debe reiniciar el timer si llega otra alerta antes de expirar', fakeAsync(() => {
            service.connect('ws://localhost:3000', '1');
            const socket = MockWebSocket.lastInstance!;
            socket.simulateOpen();

            socket.simulateMessage(JSON.stringify({ type: 'INFO', msg: 'Primero' }));
            tick(4000); // Pasan 4s de los 6

            // Llega una nueva alerta — reinicia el timer
            socket.simulateMessage(JSON.stringify({ type: 'CRITICAL', msg: 'Segundo' }));
            expect(service.currentAlert()!.msg).toBe('Segundo');

            // 4s más (8s desde la primera, pero solo 4 desde la segunda)
            tick(4000);
            expect(service.currentAlert()).not.toBeNull(); // aún visible (faltan 2s)

            // 2s más — ahora sí expira
            tick(2000);
            expect(service.currentAlert()).toBeNull();
        }));
    });

    // ══════════════════════════════════════════════════════════════
    // 2.6  Clean disconnect
    // ══════════════════════════════════════════════════════════════

    describe('disconnect()', () => {

        it('debe cerrar el socket con código 1000', () => {
            service.connect('ws://localhost:3000', '1');
            const socket = MockWebSocket.lastInstance!;
            socket.simulateOpen();

            service.disconnect();

            expect(socket.closedWith).toEqual(
                jasmine.objectContaining({ code: 1000 })
            );
        });

        it('debe limpiar currentAlert al desconectar', fakeAsync(() => {
            service.connect('ws://localhost:3000', '1');
            const socket = MockWebSocket.lastInstance!;
            socket.simulateOpen();

            socket.simulateMessage(JSON.stringify({ type: 'WARNING', msg: 'Test' }));
            expect(service.currentAlert()).not.toBeNull();

            service.disconnect();

            expect(service.currentAlert()).toBeNull();

            // Limpiar timers restantes del dismiss que ya no aplica
            discardPeriodicTasks();
        }));

        it('NO debe intentar reconectar cuando se cierra intencionalmente', fakeAsync(() => {
            service.connect('ws://localhost:3000', '1');
            const socket = MockWebSocket.lastInstance!;
            socket.simulateOpen();

            service.disconnect();
            const disconnectedSocket = MockWebSocket.lastInstance;

            // Esperar lo suficiente para detectar una reconexión
            tick(35000);

            // No debe haber una nueva instancia
            expect(MockWebSocket.lastInstance).toBe(disconnectedSocket);

            discardPeriodicTasks();
        }));
    });

    // ══════════════════════════════════════════════════════════════
    // 2.7  Exponential backoff reconnection
    // ══════════════════════════════════════════════════════════════

    describe('Reconnection — Exponential Backoff', () => {

        it('debe intentar reconectar con delays crecientes', fakeAsync(() => {
            service.connect('ws://localhost:3000', '1');
            let socket = MockWebSocket.lastInstance!;
            socket.simulateOpen();

            // Intento 1 — cierre inesperado
            socket.simulateClose(1006);
            tick(1000); // 2^0 * 1000 = 1s
            const socket2 = MockWebSocket.lastInstance!;
            expect(socket2).not.toBe(socket);

            // Intento 2
            socket2.simulateClose(1006);
            tick(2000); // 2^1 * 1000 = 2s
            const socket3 = MockWebSocket.lastInstance!;
            expect(socket3).not.toBe(socket2);

            // Intento 3
            socket3.simulateClose(1006);
            tick(4000); // 2^2 * 1000 = 4s
            const socket4 = MockWebSocket.lastInstance!;
            expect(socket4).not.toBe(socket3);

            // Limpiar
            service.disconnect();
            discardPeriodicTasks();
        }));

        it('debe dejar de intentar después de MAX_RECONNECT_ATTEMPTS (8)', fakeAsync(() => {
            service.connect('ws://localhost:3000', '1');
            let socket = MockWebSocket.lastInstance!;
            socket.simulateOpen();

            // Agotar los 8 intentos
            for (let i = 0; i < 8; i++) {
                socket.simulateClose(1006);
                const delay = Math.min(1000 * Math.pow(2, i), 30000);
                tick(delay + 100);
                socket = MockWebSocket.lastInstance!;
            }

            // El intento 9 NO debe crear un nuevo socket
            const lastSocket = MockWebSocket.lastInstance;
            socket.simulateClose(1006);
            tick(60000); // Esperar mucho

            expect(MockWebSocket.lastInstance).toBe(lastSocket);

            service.disconnect();
            discardPeriodicTasks();
        }));
    });
});
