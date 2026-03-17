import { Injectable, signal, NgZone, inject } from '@angular/core';
import { GazeLoggerFn, GazePoint } from './gaze.interfaces';

/**
 * Detecta desviación sostenida de la mirada fuera del área de pantalla.
 * Usa un stability delay para evitar flapping cuando la mirada regresa brevemente.
 */
@Injectable({ providedIn: 'root' })
export class DeviationDetectionService {
    private ngZone = inject(NgZone);
    private logger: GazeLoggerFn = () => {};
    private deviationCallback?: () => void;

    private deviationThreshold = 0.82;
    private deviationToleranceSeconds = 5;
    private readonly STABILITY_DELAY_MS = 500;

    private checkInterval: ReturnType<typeof setInterval> | null = null;
    private deviationStartTime: number | null = null;
    private lastInBoundsTime: number | null = null;

    /** Si hay una desviación sostenida activa */
    readonly hasDeviation = signal(false);

    configure(
        logger: GazeLoggerFn,
        deviationThreshold: number,
        deviationToleranceSeconds: number,
        onDeviation?: () => void
    ): void {
        this.logger = logger;
        this.deviationThreshold = deviationThreshold;
        this.deviationToleranceSeconds = deviationToleranceSeconds;
        this.deviationCallback = onDeviation;
    }

    /**
     * Inicia el intervalo periódico de verificación de desviación.
     * @param getLastPoint Callback que devuelve el último GazePoint suavizado
     */
    start(getLastPoint: () => GazePoint | null): void {
        this.stop();

        this.checkInterval = setInterval(() => {
            const point = getLastPoint();
            if (!point) return;

            const isOutOfBounds =
                Math.abs(point.x) > this.deviationThreshold ||
                Math.abs(point.y) > this.deviationThreshold;

            if (isOutOfBounds) {
                this.lastInBoundsTime = null;

                if (!this.deviationStartTime) {
                    this.deviationStartTime = Date.now();
                    console.log('[GAZE-DEV] ⚠️ Mirada fuera de pantalla — iniciando contador');
                }

                const elapsed = (Date.now() - this.deviationStartTime) / 1000;

                if (elapsed >= this.deviationToleranceSeconds && !this.hasDeviation()) {
                    this.ngZone.run(() => {
                        this.hasDeviation.set(true);
                        const msg = `🚨 GAZE_DEVIATION: Mirada fuera de pantalla por ${elapsed.toFixed(1)}s`;
                        this.logger('error', msg);
                        console.log('[GAZE-DEV]', msg);
                        this.deviationCallback?.();
                    });
                }
            } else {
                // Regresó al área — aplicar stability delay antes de resetear
                if (this.deviationStartTime) {
                    if (!this.lastInBoundsTime) {
                        this.lastInBoundsTime = Date.now();
                    } else {
                        const inBoundsElapsed = Date.now() - this.lastInBoundsTime;
                        if (inBoundsElapsed >= this.STABILITY_DELAY_MS) {
                            this.deviationStartTime = null;
                            this.lastInBoundsTime = null;
                            if (this.hasDeviation()) {
                                this.ngZone.run(() => {
                                    this.hasDeviation.set(false);
                                    const msg = '👁️ Mirada regresó al área de pantalla';
                                    this.logger('info', msg);
                                    console.log('[GAZE-DEV]', msg);
                                });
                            }
                        }
                    }
                }
            }
        }, 1000);
    }

    /** Detiene el intervalo y resetea el estado de desviación */
    stop(): void {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
        this.deviationStartTime = null;
        this.lastInBoundsTime = null;
    }

    /** Limpia toda la lógica al destruir */
    destroy(): void {
        this.stop();
        this.hasDeviation.set(false);
    }
}
