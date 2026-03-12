import { Injectable, signal, NgZone, inject, computed } from '@angular/core';
import { DestroyRefUtility } from '@lib/utils/destroy-ref.utility';
import { LoggerFn, WebGazerAPI, WebGazerPrediction, IntervalHandle } from '@lib/models/contracts';
import { GazeCalibrationService } from './gaze-calibration.service';
import { GazePredictionService } from './gaze-prediction.service';
import { GazeSmoothingService } from './gaze-smoothing.service';
import { GazeMetricsService } from './gaze-metrics.service';
import { GazeDeviationDetectionService } from './gaze-deviation-detection.service';
import { GazeWebGazerMutingService } from './gaze-webgaze-muting.service';

export interface GazePoint {
    x: number;
    y: number;
    ts: number;
}

export type GazeState = 'IDLE' | 'CALIBRATING' | 'TRACKING' | 'ERROR';

export interface GazeConfig {
    smoothingWindow: number;
    deviationThreshold: number;
    deviationToleranceSeconds: number;
    samplingIntervalMs: number;
}

const DEFAULT_CONFIG: GazeConfig = {
    smoothingWindow: 10,
    deviationThreshold: 0.85,
    deviationToleranceSeconds: 5,
    samplingIntervalMs: 1000,
};

@Injectable({ providedIn: 'root' })
export class GazeTrackingFacade {
    readonly gazeState = signal<GazeState>('IDLE');
    readonly isCalibrated = signal(false);
    readonly lastPoint = signal<GazePoint | null>(null);
    readonly hasDeviation = computed(() => this.deviationDetection.hasDeviation());

    private config: GazeConfig = { ...DEFAULT_CONFIG };
    private logger: LoggerFn = () => { };
    private deviationCallback?: () => void;
    private webgazer: WebGazerAPI | null = null;
    private gazeFrameCount = 0;
    private lastGazeLogTime = 0;
    private diagnosticInterval: IntervalHandle | undefined;

    private readonly ngZone = inject(NgZone);
    private readonly cleanup = inject(DestroyRefUtility);
    private readonly calibration = inject(GazeCalibrationService);
    private readonly prediction = inject(GazePredictionService);
    private readonly smoothing = inject(GazeSmoothingService);
    private readonly metrics = inject(GazeMetricsService);
    private readonly deviationDetection = inject(GazeDeviationDetectionService);
    private readonly webgazerMuting = inject(GazeWebGazerMutingService);

    configure(
        config: Partial<GazeConfig> = {},
        logger?: LoggerFn,
        onDeviation?: () => void
    ) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        if (logger) this.logger = logger;
        if (onDeviation) this.deviationCallback = onDeviation;
        
        if (config.smoothingWindow) {
            this.smoothing.setSmoothingWindow(config.smoothingWindow);
        }
        
        this.deviationDetection.setLogger(this.logger);
        this.deviationDetection.setConfig(
            this.config.deviationThreshold,
            this.config.deviationToleranceSeconds
        );
    }

    async startCalibration(existingStream?: MediaStream | null): Promise<boolean> {
        try {
            this.gazeState.set('CALIBRATING');
            
            this.calibration.setLogger(this.logger);
            
            this.webgazerMuting.setLogger(this.logger);
            this.webgazerMuting.start();

            const success = await this.calibration.startCalibration(existingStream);
            
            if (!success) {
                this.gazeState.set('ERROR');
                return false;
            }
            
            this.webgazer = (window as any).webgazer as WebGazerAPI;
            
            return true;
        } catch (error) {
            this.logger('error', '❌ Error al iniciar calibración', error);
            this.gazeState.set('ERROR');
            return false;
        }
    }

    recordCalibrationClick(screenX: number, screenY: number) {
        if (!this.webgazer) return;
        this.logger('info', `📍 Punto de calibración registrado en (${screenX}, ${screenY})`);
    }

    async completeCalibration() {
        try {
            const webgazer = await this.calibration.completeCalibration();
            
            if (!webgazer) {
                this.logger('error', 'Error al completar calibración en GazeCalibrationService');
                return;
            }
            
            this.isCalibrated.set(true);
            this.gazeState.set('TRACKING');
            this.smoothing.reset();
            this.metrics.clear();
            this.webgazer = webgazer;

            console.log('[GAZE] completeCalibration() — gazeFrameCount:', this.gazeFrameCount);

            this.prediction.setLogger(this.logger);
            await this.prediction.startTracking(webgazer);

            this.prediction.predictionReceived$.subscribe((prediction) => {
                if (prediction && prediction.x != null && prediction.y != null) {
                    this.gazeFrameCount++;

                    if (prediction.x === -999 && prediction.y === -999) {
                        // Rostro perdido explícitamente desde GazePredictionService
                        // Bypasseamos el suavizado y seteamos el lastPoint directamente para que DeviationDetection lo vea
                        this.lastPoint.set({ x: -999, y: -999, ts: Date.now() });
                    } else {
                        // Coordenadas normales, van por el pipeline de suavizado
                        this.processRawGaze(prediction.x, prediction.y);
                    }
                }
            });

            this.deviationDetection.start(
                () => this.lastPoint(),
                () => this.deviationCallback?.()
            );

            this.startDiagnosticLoop();

            this.logger('success', '✅ Calibración completada — Tracking activo');
        } catch (error) {
            this.logger('error', 'Error en completeCalibration:', error);
        }
    }

    flushGazeBuffer(): GazePoint[] {
        return this.metrics.flushBuffer();
    }

    getGazeBuffer(): GazePoint[] {
        return this.metrics.getBuffer();
    }

    stop() {
        this.calibration.destroy();
        this.prediction.stopTracking();
        this.smoothing.destroy();
        this.metrics.destroy();
        this.deviationDetection.destroy();
        this.webgazerMuting.destroy();
        
        try {
            if (this.webgazer) {
                this.webgazer.end();
                this.webgazer = null;
            }
        } catch {
            // WebGazer puede fallar al detenerse si ya fue destruido
        }

        this.stopDiagnosticLoop();
        this.gazeState.set('IDLE');
        this.isCalibrated.set(false);
        this.lastPoint.set(null);
        this.metrics.clear();
        this.gazeFrameCount = 0;
        this.lastGazeLogTime = 0;

        this.logger('info', '🛑 Gaze Tracking detenido');
    }

    private processRawGaze(rawX: number, rawY: number) {
        const point = this.smoothing.smoothAndNormalize(rawX, rawY);

        if (this.gazeState() === 'TRACKING') {
            this.ngZone.run(() => this.lastPoint.set(point));

            const now = Date.now();
            if (now - this.lastGazeLogTime >= 3000) {
                this.lastGazeLogTime = now;
                const metrics = this.metrics.getMetrics();
                this.logger('info', `👁️ Gaze: (${point.x}, ${point.y}) — frames: ${this.gazeFrameCount}, buffer: ${metrics.count}`);
            }

            const buffer = this.metrics.getBuffer();
            if (buffer.length === 0 ||
                point.ts - buffer[buffer.length - 1].ts >= this.config.samplingIntervalMs) {
                this.metrics.recordPoint(point);
            }
        } else if (this.gazeState() === 'CALIBRATING') {
            const now = Date.now();
            if (now - this.lastGazeLogTime >= 2000) {
                this.lastGazeLogTime = now;
                this.logger('info', `🔬 Calibrando — Gaze raw: (${point.x}, ${point.y}) — frames: ${this.gazeFrameCount}`);
            }
        }
    }

    private startDiagnosticLoop() {
        this.stopDiagnosticLoop();

        let lastCheckedFrameCount = this.prediction.getFrameCount();

        this.diagnosticInterval = this.cleanup.setInterval(() => {
            const wg = this.webgazer;
            const currentFrames = this.prediction.getFrameCount();
            const newFrames = currentFrames - lastCheckedFrameCount;
            lastCheckedFrameCount = currentFrames;

            const videoEl = document.getElementById('webgazerVideoFeed') as HTMLVideoElement | null;

            if (newFrames === 0) {
                if (currentFrames % 5 === 0) {
                    this.logger('error', '⚠️ WebGazer no envía datos de gaze (pipeline detenido)');
                }
            }
        }, 10000);
    }

    private stopDiagnosticLoop() {
        if (this.diagnosticInterval) {
            clearInterval(this.diagnosticInterval);
            this.diagnosticInterval = undefined;
        }
    }
}
