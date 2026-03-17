import { Injectable, signal } from '@angular/core';
import { GazeCalibrationMetrics, GazeLoggerFn, GazeState } from './gaze.interfaces';

/**
 * Gestiona el ciclo de vida de la calibración:
 * estado IDLE → CALIBRATING → TRACKING, métricas y clicks.
 */
@Injectable({ providedIn: 'root' })
export class CalibrationService {
    private logger: GazeLoggerFn = () => {};
    private webgazerRef: any = null;

    // Métricas de calibración
    private calibrationClicks = 0;
    private calibrationFrames = 0;
    private trackingFrames = 0;
    private calibrationStartTime: number | null = null;
    private calibrationCompleteTime: number | null = null;
    private confidenceSum = 0;
    private confidenceCount = 0;

    configure(logger: GazeLoggerFn, webgazerRef: any): void {
        this.logger = logger;
        this.webgazerRef = webgazerRef;
    }

    /**
     * Inicia la fase de calibración. Resetea métricas.
     */
    start(): void {
        this.calibrationClicks = 0;
        this.calibrationFrames = 0;
        this.calibrationStartTime = Date.now();
        this.calibrationCompleteTime = null;
        this.confidenceSum = 0;
        this.confidenceCount = 0;
    }

    /**
     * Registra un click de calibración (el usuario hace clic mientras mira el punto).
     */
    recordClick(screenX: number, screenY: number): void {
        this.calibrationClicks++;
        const progress = this.calibrationClicks >= 9 ? '✅' : this.calibrationClicks >= 5 ? '🔄' : '⏳';
        const msg = `${progress} Click #${this.calibrationClicks} registrado en (${Math.round(screenX)}, ${Math.round(screenY)})`;
        this.logger('success', msg);
        console.log('[GAZE-CAL]', msg);
    }

    /**
     * Registra un frame de gaze recibido durante calibración.
     */
    recordCalibrationFrame(): void {
        this.calibrationFrames++;
    }

    /**
     * Registra un frame de gaze recibido durante tracking.
     */
    recordTrackingFrame(): void {
        this.trackingFrames++;
    }

    /**
     * Registra un dato de confianza para el promedio.
     */
    recordConfidence(confidence: number): void {
        this.confidenceSum += confidence;
        this.confidenceCount++;
    }

    /**
     * Finaliza la calibración, resume WebGazer y retorna las métricas.
     */
    complete(currentState: () => GazeState): GazeCalibrationMetrics {
        this.calibrationCompleteTime = Date.now();
        const metrics = this.getMetrics();

        const duration = metrics.calibrationCompleteTime && metrics.calibrationStartTime
            ? ((metrics.calibrationCompleteTime - metrics.calibrationStartTime) / 1000).toFixed(1)
            : 'N/A';

        const quality = metrics.calibrationFrames >= 100 ? '🟢 Excelente'
            : metrics.calibrationFrames >= 50 ? '🟡 Bueno'
            : metrics.calibrationFrames >= 20 ? '🟠 Regular'
            : '🔴 Insuficiente';

        this.logger('success', `📊 CALIBRACIÓN COMPLETA | Clicks: ${metrics.calibrationClicks} | Frames: ${metrics.calibrationFrames} | Duración: ${duration}s | ${quality}`);
        console.log(`[GAZE-CAL] 📊 CALIBRACIÓN COMPLETA | Clicks: ${metrics.calibrationClicks} | Frames: ${metrics.calibrationFrames} | Duración: ${duration}s | ${quality}`);

        if (this.webgazerRef) {
            try {
                if (typeof this.webgazerRef.resume === 'function') {
                    this.webgazerRef.resume();
                    console.log('[GAZE-CAL] webgazer.resume() llamado');
                }
            } catch (e) {
                console.warn('[GAZE-CAL] webgazer.resume() falló:', e);
            }
        }

        return metrics;
    }

    /**
     * Retorna las métricas actuales de calibración y tracking.
     */
    getMetrics(): GazeCalibrationMetrics {
        const avgConfidence = this.confidenceCount > 0
            ? this.confidenceSum / this.confidenceCount
            : null;

        return {
            calibrationClicks: this.calibrationClicks,
            calibrationFrames: this.calibrationFrames,
            trackingFrames: this.trackingFrames,
            faceDetected: this.calibrationFrames > 0,
            avgConfidence,
            calibrationStartTime: this.calibrationStartTime,
            calibrationCompleteTime: this.calibrationCompleteTime,
        };
    }
}
