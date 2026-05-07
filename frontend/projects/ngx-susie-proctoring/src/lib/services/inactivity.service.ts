import { Injectable, signal, OnDestroy, inject } from '@angular/core';
import { DestroyRefUtility } from '@lib/utils/destroy-ref.utility';

@Injectable({ providedIn: 'root' })
export class InactivityService implements OnDestroy {
    showWarning = signal(false);

    private timeoutId: ReturnType<typeof setTimeout> | undefined;
    private warningTimeoutId: ReturnType<typeof setTimeout> | undefined;
    private inactivityLimitMs = 3 * 60 * 1000; // 3 min default
    private onInactivityCallback?: () => void;
    private events = ['mousemove', 'keydown', 'click', 'scroll'];
    private lastActivity = Date.now();
    private checkInterval: ReturnType<typeof setInterval> | undefined;
    private cleanup = inject(DestroyRefUtility);

    configure(limitMinutes: number, callback?: () => void) {
        if (limitMinutes > 0) {
            this.inactivityLimitMs = limitMinutes * 60 * 1000;
            this.onInactivityCallback = callback;
        }
    }

    startMonitoring() {
        this.stopMonitoring();

        // Escuchar eventos de usuario
        this.events.forEach(event => {
            this.cleanup.addEventListener(window, event, this.handleUserActivity, { passive: true });
        });

        // Verificar periódicamente
        this.checkInterval = this.cleanup.setInterval(() => {
            const now = Date.now();
            const elapsed = now - this.lastActivity;

            // Lógica de advertencia: mostrar alerta si pasó el 90% del tiempo
            if (!this.showWarning() && elapsed > this.inactivityLimitMs * 0.9) {
                this.showWarning.set(true);
            }

            // Lógica de timeout
            if (elapsed > this.inactivityLimitMs) {
                this.handleTimeout();
            }
        }, 5000);
    }

    stopMonitoring() {
        this.events.forEach(event => {
            this.cleanup.removeEventListener(window, event, this.handleUserActivity);
        });
        if (this.checkInterval) {
            this.cleanup.clearInterval(this.checkInterval);
            this.checkInterval = undefined;
        }
        this.showWarning.set(false);
    }

    resetTimer() {
        this.showWarning.set(false);
        this.lastActivity = Date.now();
    }

    private handleUserActivity = () => {
        // Solo resetear si no está en estado de advertencia (forzar usuario a hacer click en "Estoy aquí")
        // O quizás resetear automáticamente? Reseteemos automáticamente a menos que se muestre advertencia?
        // El requerimiento del usuario típicamente implica confirmación explícita si se muestra advertencia.
        if (!this.showWarning()) {
            this.lastActivity = Date.now();
        }
    };

    private handleTimeout() {
        this.onInactivityCallback?.();
        // Resetear para evitar múltiples triggers? O seguir disparando?
        this.resetTimer();
    }

    ngOnDestroy() {
        this.stopMonitoring();
    }
}
