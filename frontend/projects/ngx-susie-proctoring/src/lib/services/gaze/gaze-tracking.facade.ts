import { Injectable, signal, NgZone, DestroyRef, inject } from '@angular/core';
import { GazeConfig, GazeCalibrationMetrics, GazeLoggerFn, GazePoint, GazeState, RawGazeEvent } from './gaze.interfaces';
import { WebGazerBridgeService } from './webgazer-bridge.service';
import { CalibrationService } from './calibration.service';
import { SignalSmoothingService } from './signal-smoothing.service';
import { FaceDetectionService } from './face-detection.service';
import { DeviationDetectionService } from './deviation-detection.service';
import { HeadPoseAnalyzerService } from './head-pose-analyzer.service';
import { DomManagerService } from './dom-manager.service';
import { GazeDiagnosticsService } from './gaze-diagnostics.service';

const DEFAULT_CONFIG: GazeConfig = {
    smoothingWindow: 10,
    deviationThreshold: 0.82,
    deviationToleranceSeconds: 5,
    samplingIntervalMs: 1000,
};

/**
 * Fachada pública del sistema de Gaze Tracking.
 *
 * Mantiene la misma API que el monolito `GazeTrackingService` (señales + métodos)
 * y delega toda la lógica a sus sub-servicios especializados.
 *
 * Los 5 consumers existentes (Orchestrator, MonitorHelper, GazeCalibrationComponent,
 * GazeDeviationAlertComponent, FaceLossCountdownComponent) inyectan este servicio
 * sin necesitar ningún cambio.
 */
@Injectable({ providedIn: 'root' })
export class GazeTrackingFacadeService {
    // ─── Public Signals (same API as monolith) ─────────────────────────────
    readonly gazeState = signal<GazeState>('IDLE');
    readonly isCalibrated = signal(false);
    readonly lastPoint = signal<GazePoint | null>(null);
    readonly isInitializing = signal(false);

    // Delegated from FaceDetectionService
    get isFaceDetected() { return this.faceDetection.isFaceDetected; }
    get isCountdownVisible() { return this.faceDetection.isCountdownVisible; }
    get countdownValue() { return this.faceDetection.countdownValue; }

    // Delegated from DeviationDetectionService
    get hasDeviation() { return this.deviationDetection.hasDeviation; }

    // ─── Private state ──────────────────────────────────────────────────────
    private config: GazeConfig = { ...DEFAULT_CONFIG };
    private logger: GazeLoggerFn = () => {};
    private gazeBuffer: GazePoint[] = [];
    private readonly maxBufferSize = 60;
    private gazeFrameCount = 0;
    private lastGazeLogTime = 0;

    // ─── Injection ──────────────────────────────────────────────────────────
    private readonly ngZone = inject(NgZone);
    private readonly destroyRef = inject(DestroyRef);
    private readonly bridge = inject(WebGazerBridgeService);
    private readonly calibration = inject(CalibrationService);
    private readonly smoothing = inject(SignalSmoothingService);
    private readonly faceDetection = inject(FaceDetectionService);
    private readonly deviationDetection = inject(DeviationDetectionService);
    private readonly headPose = inject(HeadPoseAnalyzerService);
    private readonly domManager = inject(DomManagerService);
    private readonly diagnostics = inject(GazeDiagnosticsService);

    constructor() {
        (window as any).gazeService = this; // debug aid
        this.destroyRef.onDestroy(() => this.stop());
    }

    // ─── Public API ─────────────────────────────────────────────────────────

    /**
     * Configura el servicio antes de iniciar la calibración.
     */
    configure(
        config: Partial<GazeConfig> = {},
        logger?: GazeLoggerFn,
        onDeviation?: () => void,
        onNoFace?: () => void
    ): void {
        this.config = { ...DEFAULT_CONFIG, ...config };
        if (logger) this.logger = logger;

        this.logger('info', '⚙️ GazeTrackingFacade configurado');
        this.bridge.configure(this.logger);
        this.calibration.configure(this.logger, null); // webgazerRef se actualiza en startCalibration
        this.smoothing.configure(this.config.smoothingWindow);
        this.faceDetection.configure(this.logger, onNoFace, () => {
            // Face recovered → reset Kalman filters
            this.smoothing.reset();
        });
        this.deviationDetection.configure(
            this.logger,
            this.config.deviationThreshold,
            this.config.deviationToleranceSeconds,
            onDeviation
        );
        this.headPose.configure(this.logger);
        this.domManager.configure(this.logger);
        this.diagnostics.configure(this.logger);
    }

    /**
     * Inicia WebGazer en modo calibración.
     */
    async startCalibration(existingStream?: MediaStream | null): Promise<boolean> {
        if (this.isInitializing()) {
            console.log('[GAZE-FACADE] Ya inicializando, ignorando.');
            return false;
        }

        try {
            this.isInitializing.set(true);
            this.gazeState.set('CALIBRATING');
            this.gazeFrameCount = 0;
            this.lastGazeLogTime = 0;
            this.gazeBuffer = [];

            this.calibration.configure(this.logger, null);
            this.calibration.start();

            this.logger('info', '🎯 Iniciando calibración de gaze...');
            console.log('[GAZE-FACADE] 🎯 Iniciando calibración...');

            this.domManager.injectStyles();
            this.domManager.startAggressiveMuting();

            // Wire up bridge listeners
            this.bridge.onGaze((event: RawGazeEvent) => this.onRawGaze(event));
            this.bridge.onNoFace(() => {
                if (this.gazeState() === 'TRACKING') {
                    this.faceDetection.handleNoFace();
                }
            });

            const started = await this.bridge.begin(existingStream);
            if (!started) {
                this.gazeState.set('ERROR');
                this.isInitializing.set(false);
                return false;
            }

            // Update calibration service with webgazer reference
            this.calibration.configure(this.logger, this.bridge.instance);

            this.bridge.configureVideo(true, true, true);
            this.domManager.muteAll();
            this.domManager.applyGreenFaceOverlay();

            // Cámara semi-transparente detrás de los puntos + gaze dot rojo visible
            setTimeout(() => {
                this.domManager.configureVideoForCalibration();
                this.domManager.showGazeDot();
            }, 500);

            this.logger('success', '👁️ WebGazer iniciado — Haz clic en los puntos rojos mirándolos fijamente');
            this.isInitializing.set(false);
            return true;
        } catch (error) {
            this.logger('error', '❌ Error al iniciar WebGazer', error);
            this.gazeState.set('ERROR');
            this.isInitializing.set(false);
            return false;
        }
    }

    /**
     * Registra un click de calibración.
     */
    recordCalibrationClick(screenX: number, screenY: number): void {
        this.calibration.recordClick(screenX, screenY);
    }

    /**
     * Marca la calibración como completada e inicia el tracking real.
     */
    completeCalibration(): void {
        this.isCalibrated.set(true);
        this.gazeState.set('TRACKING');
        this.smoothing.reset();
        this.gazeBuffer = [];

        this.calibration.complete(() => this.gazeState());
        this.bridge.resume();
        this.domManager.hideGazeDot();
        this.domManager.configureVideoForExam();
        this.bridge.showVideo(true);
        this.bridge.showFaceOverlay(true);
        setTimeout(() => this.domManager.applyGreenFaceOverlay(), 500);

        this.deviationDetection.start(() => this.lastPoint());
        this.diagnostics.start(
            () => this.gazeFrameCount,
            () => this.gazeState()
        );

        this.logger('success', '✅ Calibración completada — Tracking activo');
    }

    /**
     * Devuelve y vacía el buffer de coordenadas (para enviar con snapshots).
     */
    flushGazeBuffer(): GazePoint[] {
        const snapshot = [...this.gazeBuffer];
        this.gazeBuffer = [];
        return snapshot;
    }

    /**
     * Obtiene el buffer sin vaciarlo.
     */
    getGazeBuffer(): GazePoint[] {
        return [...this.gazeBuffer];
    }

    /**
     * Retorna las métricas de calibración actuales.
     */
    getCalibrationMetrics(): GazeCalibrationMetrics {
        return this.calibration.getMetrics();
    }

    /**
     * Detiene todo: WebGazer, intervalos, DOM y resetea el estado.
     */
    stop(): void {
        this.bridge.stop();
        this.domManager.cleanup();
        this.deviationDetection.destroy();
        this.diagnostics.stop();
        this.faceDetection.reset();

        this.gazeState.set('IDLE');
        this.isCalibrated.set(false);
        this.lastPoint.set(null);
        this.isInitializing.set(false);
        this.gazeBuffer = [];
        this.gazeFrameCount = 0;
        this.lastGazeLogTime = 0;
        this.smoothing.reset();

        this.logger('info', '🛑 Gaze Tracking detenido');
    }

    // ─── Private Pipeline ────────────────────────────────────────────────────

    /**
     * Pipeline de procesamiento para cada frame de gaze recibido desde el bridge.
     * Orden: confidence check → head pose → face detection → smoothing → buffer
     */
    private onRawGaze(event: RawGazeEvent): void {
        this.gazeFrameCount++;

        // Frame counting por estado
        if (this.gazeState() === 'CALIBRATING') {
            this.calibration.recordCalibrationFrame();
        } else if (this.gazeState() === 'TRACKING') {
            this.calibration.recordTrackingFrame();
        }

        // Confidence check
        if (event.confidence != null) {
            this.calibration.recordConfidence(event.confidence);
            if (event.confidence < 0.6 && this.gazeState() === 'TRACKING') {
                this.faceDetection.handleNoFace();
                return;
            }
        }

        // Head pose analysis (only during tracking)
        if (this.gazeState() === 'TRACKING') {
            const pose = this.headPose.analyze(event.rawData);
            if (pose.isProfile) {
                this.faceDetection.handleNoFace();
                return;
            }
        }

        // Face recovered
        this.faceDetection.handleFaceDetected();

        // Signal smoothing (pass confidence to Kalman filter)
        const smoothed = this.smoothing.process(event.rawX, event.rawY, event.confidence ?? undefined);
        if (!smoothed) return;

        // Actualizar gaze dot en pantalla (ambos modos: calibración y tracking)
        this.domManager.updateGazeDot(event.rawX, event.rawY);

        // Only store in TRACKING state (not during calibration)
        if (this.gazeState() === 'TRACKING') {
            this.ngZone.run(() => this.lastPoint.set(smoothed));

            // Periodic log
            const now = Date.now();
            if (now - this.lastGazeLogTime >= 3000) {
                this.lastGazeLogTime = now;
                this.logger('info', `👁️ Gaze: (${smoothed.x}, ${smoothed.y}) — frames: ${this.gazeFrameCount}`);
            }

            // Buffer management
            const last = this.gazeBuffer[this.gazeBuffer.length - 1];
            if (!last || smoothed.ts - last.ts >= this.config.samplingIntervalMs) {
                this.gazeBuffer.push(smoothed);
                if (this.gazeBuffer.length > this.maxBufferSize) {
                    this.gazeBuffer.shift();
                }
            }
        }
    }
}

// Re-export as GazeTrackingService for backward compatibility
export { GazeTrackingFacadeService as GazeTrackingService };
