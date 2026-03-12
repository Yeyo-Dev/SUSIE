import { Injectable, signal, NgZone, inject, DestroyRef } from '@angular/core';
import { LoggerFn } from '@lib/models/contracts';
import { GazePoint } from './gaze-smoothing.service';

export interface GazeDeviationConfig {
    deviationThreshold: number;
    deviationToleranceSeconds: number;
}

@Injectable({ providedIn: 'root' })
export class GazeDeviationDetectionService {
    private destroyRef = inject(DestroyRef);
    private ngZone = inject(NgZone);
    private logger: LoggerFn = () => {};

    private deviationThreshold = 0.85;
    private deviationToleranceSeconds = 5;

    readonly hasDeviation = signal(false);

    private deviationStartTime: number | null = null;
    private deviationCheckInterval: ReturnType<typeof setInterval> | undefined;
    private deviationCallback?: () => void;
    private lastPointProvider: (() => GazePoint | null) | null = null;

    constructor() {
        this.destroyRef.onDestroy(() => this.destroy());
    }

    setLogger(logger: LoggerFn): void {
        this.logger = logger;
    }

    setConfig(threshold: number, toleranceSeconds: number): void {
        this.deviationThreshold = threshold;
        this.deviationToleranceSeconds = toleranceSeconds;
    }

    private lastFrozenPoint: GazePoint | null = null;
    private frozenDurationMs: number = 0;

    start(lastPointProvider: () => GazePoint | null, onDeviation?: () => void): void {
        this.stop();

        this.lastPointProvider = lastPointProvider;
        if (onDeviation) {
            this.deviationCallback = onDeviation;
        }

        const TICK_MS = 1000;
        this.deviationCheckInterval = setInterval(() => {
            const point = this.lastPointProvider?.();
            if (!point) return;

            // Detectar si el punto está 100% congelado (WebGazer perdió el rostro)
            let isFrozen = false;
            if (this.lastFrozenPoint && this.lastFrozenPoint.x === point.x && this.lastFrozenPoint.y === point.y) {
                this.frozenDurationMs += TICK_MS;
            } else {
                this.frozenDurationMs = 0;
                this.lastFrozenPoint = { ...point };
            }

            // Consideramos "Pérdida de visión" si está congelado por más de 2 segundos,
            // ya que el ojo humano tiene microsacadas naturales y NUNCA está perfectamente quieto a nivel subpixel.
            if (this.frozenDurationMs >= 2000) {
                isFrozen = true;
            }

            // O está mirando fuera de la pantalla, o perdimos el rostro por completo.
            // point.x/y === -999 es el código que envía GazePredictionService cuando no detecta rostro
            const faceLostExplicitly = point.x === -999 || point.y === -999;
            const isOutOfBounds =
                faceLostExplicitly ||
                Math.abs(point.x) > this.deviationThreshold ||
                Math.abs(point.y) > this.deviationThreshold;

            if (isOutOfBounds || isFrozen) {
                const now = Date.now();
                if (!this.deviationStartTime) {
                    this.deviationStartTime = now;
                }

                const elapsed = (now - this.deviationStartTime) / 1000;

                if (elapsed >= this.deviationToleranceSeconds && !this.hasDeviation()) {
                    this.hasDeviation.set(true);
                    const reason = isFrozen ? 'Rostro no detectado / Pérdida de visión' : 'Mirada fuera de pantalla';
                    this.logger('error', `🚨 GAZE_DEVIATION: ${reason} por ${elapsed.toFixed(1)}s`);
                    this.deviationCallback?.();
                }
            } else {
                if (this.deviationStartTime) {
                    this.deviationStartTime = null;
                    if (this.hasDeviation()) {
                        this.hasDeviation.set(false);
                        this.logger('info', '👁️ Mirada regresó al área de pantalla');
                    }
                }
            }
        }, 1000);
    }

    stop(): void {
        if (this.deviationCheckInterval) {
            clearInterval(this.deviationCheckInterval);
            this.deviationCheckInterval = undefined;
        }
        this.deviationStartTime = null;
        this.lastPointProvider = null;
        this.deviationCallback = undefined;
    }

    reset(): void {
        this.deviationStartTime = null;
        this.hasDeviation.set(false);
    }

    destroy(): void {
        this.stop();
        this.hasDeviation.set(false);
    }

    getDeviationDuration(): number {
        if (!this.deviationStartTime) return 0;
        return Date.now() - this.deviationStartTime;
    }

    getDeviationStatus(): boolean {
        return this.hasDeviation();
    }
}
