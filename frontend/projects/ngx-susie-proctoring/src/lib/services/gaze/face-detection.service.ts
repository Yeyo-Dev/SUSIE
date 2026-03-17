import { Injectable, signal, NgZone, inject } from '@angular/core';
import { GazeLoggerFn } from './gaze.interfaces';

/**
 * Detecta la pérdida de rostro durante el tracking y gestiona:
 * - Grace period (3s silencioso)
 * - Countdown visible (10s)
 * - Disparo de infracción si el rostro no regresa
 */
@Injectable({ providedIn: 'root' })
export class FaceDetectionService {
    private ngZone = inject(NgZone);
    private logger: GazeLoggerFn = () => {};
    private noFaceCallback?: () => void;
    private onFaceRecovered?: () => void;

    private faceLossGraceTimer: ReturnType<typeof setTimeout> | null = null;
    private countdownInterval: ReturnType<typeof setInterval> | null = null;

    /** Si el rostro está actualmente detectado */
    readonly isFaceDetected = signal(true);
    /** Si el overlay de countdown debe ser visible */
    readonly isCountdownVisible = signal(false);
    /** Valor actual del countdown (10 → 0) */
    readonly countdownValue = signal(10);

    configure(
        logger: GazeLoggerFn,
        onNoFace?: () => void,
        onFaceRecovered?: () => void
    ): void {
        this.logger = logger;
        this.noFaceCallback = onNoFace;
        this.onFaceRecovered = onFaceRecovered;
    }

    /**
     * Maneja la detección de "sin rostro" durante el tracking.
     * Solo actúa si el rostro estaba detectado y no hay timer en curso.
     */
    handleNoFace(): void {
        if (!this.isFaceDetected()) return;
        if (this.faceLossGraceTimer || this.countdownInterval) return;

        console.log('[GAZE-FACE] ⚠️ Rostro no detectado — Iniciando grace period de 3s');
        this.ngZone.run(() => this.isFaceDetected.set(false));

        this.faceLossGraceTimer = setTimeout(() => {
            this.ngZone.run(() => {
                this.isCountdownVisible.set(true);
                this.countdownValue.set(10);
            });

            this.logger('warn', '⚠️ ROSTRO NO DETECTADO — Tienes 10 segundos para regresar');

            this.countdownInterval = setInterval(() => {
                this.ngZone.run(() => {
                    const current = this.countdownValue();
                    if (current > 0) {
                        this.countdownValue.set(current - 1);
                    } else {
                        this.triggerInfraction();
                    }
                });
            }, 1000);
        }, 3000);
    }

    /**
     * Maneja la redetección del rostro. Cancela todos los timers.
     * @returns true si se recuperó de una pérdida activa (para que la facade resetee filtros)
     */
    handleFaceDetected(): boolean {
        const wasLost = !this.isFaceDetected();
        if (wasLost) {
            console.log('[GAZE-FACE] ✅ Rostro detectado nuevamente');
        }
        this.reset();
        this.onFaceRecovered?.();
        return wasLost;
    }

    /** Resetea toda la lógica de pérdida de rostro */
    reset(): void {
        if (this.faceLossGraceTimer) {
            clearTimeout(this.faceLossGraceTimer);
            this.faceLossGraceTimer = null;
        }
        if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
            this.countdownInterval = null;
        }
        this.ngZone.run(() => {
            this.isFaceDetected.set(true);
            this.isCountdownVisible.set(false);
            this.countdownValue.set(10);
        });
    }

    /** Limpia todos los timers al destruir */
    destroy(): void {
        this.reset();
    }

    private triggerInfraction(): void {
        console.log('[GAZE-FACE] ❌ INFRACCIÓN: Rostro no detectado por tiempo prolongado');
        this.logger('error', '❌ INFRACCIÓN: Rostro no detectado por tiempo prolongado');
        this.noFaceCallback?.();
        this.reset();
    }
}
