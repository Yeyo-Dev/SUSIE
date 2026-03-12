import { Injectable, signal, NgZone, inject } from '@angular/core';
import { DestroyRefUtility } from '@lib/utils/destroy-ref.utility';
import {
    LoggerFn,
    WebGazerAPI,
    WebGazerPrediction,
    IntervalHandle,
} from '@lib/models/contracts';
import { GazeCalibrationService } from './gaze/gaze-calibration.service';
import { GazePredictionService } from './gaze/gaze-prediction.service';
import { GazeSmoothingService } from './gaze/gaze-smoothing.service';
import { GazeMetricsService } from './gaze/gaze-metrics.service';
import { GazeDeviationDetectionService } from './gaze/gaze-deviation-detection.service';
import { GazeWebGazerMutingService } from './gaze/gaze-webgaze-muting.service';

/** Coordenada suavizada de gaze tracking */
export interface GazePoint {
    x: number;   // -1 (izquierda) a 1 (derecha), 0 = centro
    y: number;   // -1 (arriba) a 1 (abajo), 0 = centro
    ts: number;  // timestamp epoch ms
}

/** Estado del servicio de gaze */
export type GazeState = 'IDLE' | 'CALIBRATING' | 'TRACKING' | 'ERROR';

/** Configuración del gaze tracking */
export interface GazeConfig {
    /** Cantidad de frames para promediar (suavizado) */
    smoothingWindow: number;
    /** Umbral normalizado: si |x| o |y| > threshold, se considera "fuera de pantalla" */
    deviationThreshold: number;
    /** Segundos consecutivos fuera del umbral para emitir GAZE_DEVIATION */
    deviationToleranceSeconds: number;
    /** Intervalo en ms para muestrear el buffer de coordenadas */
    samplingIntervalMs: number;
}

const DEFAULT_CONFIG: GazeConfig = {
    smoothingWindow: 10,
    deviationThreshold: 0.85,
    deviationToleranceSeconds: 5,
    samplingIntervalMs: 1000,
};

@Injectable({ providedIn: 'root' })
export class GazeTrackingService {
    /** Estado reactivo del servicio */
    readonly gazeState = signal<GazeState>('IDLE');

    /** Indica si la calibración fue completada exitosamente */
    readonly isCalibrated = signal(false);

    /** Último punto suavizado (para debug/UI) */
    readonly lastPoint = signal<GazePoint | null>(null);

    /** Si hay una desviación sostenida activa */
    readonly hasDeviation = () => this.deviationDetection.hasDeviation();

    private config: GazeConfig = { ...DEFAULT_CONFIG };
    private logger: LoggerFn = () => { };
    private deviationCallback?: () => void;

    // Buffer de coordenadas para telemetría (se envía con snapshots)
    // DELEGADO A: GazeMetricsService (Fase 4)

      // Referencia a WebGazer (se carga globalmente)
      private webgazer: WebGazerAPI | null = null;

    // Contador de frames de gaze recibidos
    private gazeFrameCount = 0;
    private lastGazeLogTime = 0;

    // Diagnóstico para debugging
    private diagnosticInterval: IntervalHandle | undefined;

    // Polling manual de gaze (fallback cuando setGazeListener deja de funcionar)
    // AHORA DELEGADO A: GazePredictionService (Fase 2)

    constructor(
        private ngZone: NgZone,
        private cleanup: DestroyRefUtility,
        // Phase 0: Inject sub-services for descomposition
        // Phase 1: Calibration Service - handles initial calibration process
        private calibration: GazeCalibrationService,
        // Phase 2: Prediction Service - captures raw predictions from WebGazer
        private prediction: GazePredictionService,
        // Phase 3: Smoothing Service - normalizes and smooths raw coordinates
        private smoothing: GazeSmoothingService,
        // Phase 4: Metrics Service - aggregates and buffers smoothed points
        private metrics: GazeMetricsService,
        // Phase 5: Deviation Detection Service - detects sustained gaze deviations
        private deviationDetection: GazeDeviationDetectionService,
        // Phase 6: WebGazer Muting Service - silences WebGazer video elements
        private webgazerMuting: GazeWebGazerMutingService
    ) { }

    /** Configura el servicio */
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

    /**
     * Inicia WebGazer en modo calibración.
     * DELEGADO A: GazeCalibrationService (Fase 1)
     * Acepta un MediaStream existente para evitar conflictos con getUserMedia.
     */
    async startCalibration(existingStream?: MediaStream | null): Promise<boolean> {
        try {
            this.gazeState.set('CALIBRATING');
            
            // Configurar logger en el servicio de calibración
            this.calibration.setLogger(this.logger);
            
            // FASE 6: Iniciar muting antes de begin()
            this.webgazerMuting.setLogger(this.logger);
            this.webgazerMuting.start();

            // FASE 1: Delegamos la lógica de inicialización de WebGazer al GazeCalibrationService
            const success = await this.calibration.startCalibration(existingStream);
            
            if (!success) {
                this.gazeState.set('ERROR');
                return false;
            }
            
            // Obtener referencia a WebGazer del servicio de calibración
            this.webgazer = (window as any).webgazer as WebGazerAPI;
            
            return true;
        } catch (error) {
            this.logger('error', '❌ Error al iniciar calibración', error);
            this.gazeState.set('ERROR');
            return false;
        }
    }

    /**
     * Registra un punto de calibración (el usuario hace clic mirando un punto específico).
     * WebGazer aprende de la posición del clic + la posición de los ojos.
     */
    recordCalibrationClick(screenX: number, screenY: number) {
        if (!this.webgazer) return;
        // WebGazer registra automáticamente los clics como datos de entrenamiento
        // Solo necesitamos loguearlo para feedback
        this.logger('info', `📍 Punto de calibración registrado en (${screenX}, ${screenY})`);
    }

    /**
     * Marca la calibración como completada y comienza el tracking real.
     * DELEGADO A: GazeCalibrationService (Fase 1)
     */
    async completeCalibration() {
        try {
            // FASE 1: Delegamos el cleanup de calibración al GazeCalibrationService
            const webgazer = await this.calibration.completeCalibration();
            
            if (!webgazer) {
                this.logger('error', 'Error al completar calibración en GazeCalibrationService');
                return;
            }
            
            // Actualizar estado local
            this.isCalibrated.set(true);
            this.gazeState.set('TRACKING');
            this.smoothing.reset();
            this.metrics.clear();
            this.webgazer = webgazer;

            console.log('[GAZE] completeCalibration() — gazeFrameCount:', this.gazeFrameCount);

            // FASE 2: Delegar polling y captura de predicciones a GazePredictionService
            this.prediction.setLogger(this.logger);
            await this.prediction.startTracking(webgazer);

            // Suscribirse a predicciones crudas y procesarlas
            this.prediction.predictionReceived$.subscribe((prediction) => {
                if (prediction && prediction.x != null && prediction.y != null) {
                    this.gazeFrameCount++;
                    this.processRawGaze(prediction.x, prediction.y);
                }
            });

            // Iniciar chequeo de desviación periódico
            this.deviationDetection.start(
                () => this.lastPoint(),
                () => this.deviationCallback?.()
            );

            // Iniciar diagnóstico
            this.startDiagnosticLoop();

            this.logger('success', '✅ Calibración completada — Tracking activo (delegado a GazePredictionService)');
        } catch (error) {
            this.logger('error', 'Error en completeCalibration:', error);
        }
    }

    /**
     * Devuelve y limpia el buffer de coordenadas recientes (para enviar con snapshots).
     * DELEGADO A: GazeMetricsService (Fase 4)
     */
    flushGazeBuffer(): GazePoint[] {
        return this.metrics.flushBuffer();
    }

    /**
     * Obtiene el buffer actual sin limpiarlo (para lectura).
     * DELEGADO A: GazeMetricsService (Fase 4)
     */
    getGazeBuffer(): GazePoint[] {
        return this.metrics.getBuffer();
    }

    /**
     * Detiene todo: WebGazer, intervalos y limpia estado.
     */
    stop() {
        // FASE 1: Limpiar el servicio de calibración
        this.calibration.destroy();
        
        // FASE 2: Limpiar el servicio de predicciones
        this.prediction.stopTracking();
        
        // FASE 3: Limpiar el servicio de smoothing
        this.smoothing.destroy();
        
        // FASE 4: Limpiar el servicio de métricas
        this.metrics.destroy();
        
        // FASE 5: Limpiar el servicio de detección de desviación
        this.deviationDetection.destroy();
        
        // FASE 6: Limpiar el servicio de muting
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

    // ─── Internals ───────────────────────────────────────────

    /**
     * Procesa coordenadas brutas del gaze listener de WebGazer.
     * Escala a [-1, 1], suaviza y almacena.
     * DELEGADO A: GazeSmoothingService (Fase 3)
     */
    private processRawGaze(rawX: number, rawY: number) {
        const point = this.smoothing.smoothAndNormalize(rawX, rawY);

        // Solo almacenar si estamos en TRACKING (no durante calibración)
        if (this.gazeState() === 'TRACKING') {
            this.ngZone.run(() => this.lastPoint.set(point));

            // Log periódico via logger (cada 3 segundos)
            const now = Date.now();
            if (now - this.lastGazeLogTime >= 3000) {
                this.lastGazeLogTime = now;
                const metrics = this.metrics.getMetrics();
                this.logger('info', `👁️ Gaze: (${point.x}, ${point.y}) — frames: ${this.gazeFrameCount}, buffer: ${metrics.count}`);
            }

            // DELEGADO A: GazeMetricsService (Fase 4)
            const buffer = this.metrics.getBuffer();
            if (buffer.length === 0 ||
                point.ts - buffer[buffer.length - 1].ts >= this.config.samplingIntervalMs) {
                this.metrics.recordPoint(point);
            }
        } else if (this.gazeState() === 'CALIBRATING') {
            // Durante calibración, loguear cada 2 segundos para verificar que WebGazer funciona
            const now = Date.now();
            if (now - this.lastGazeLogTime >= 2000) {
                this.lastGazeLogTime = now;
                this.logger('info', `🔬 Calibrando — Gaze raw: (${point.x}, ${point.y}) — frames: ${this.gazeFrameCount}`);
            }
        }
    }

    // FASE 2: Polling DELEGADO a GazePredictionService
    // Los métodos startManualPolling() y stopManualPolling() fueron movidos

     /**
      * Diagnóstico: verifica cada 2s que WebGazer sigue procesando frames.
      * Logs directos a console.log para máxima visibilidad.
      */
     private startDiagnosticLoop() {
         this.stopDiagnosticLoop();

         let lastCheckedFrameCount = this.prediction.getFrameCount();

         this.diagnosticInterval = this.cleanup.setInterval(() => {
             const wg = this.webgazer;
             const currentFrames = this.prediction.getFrameCount();
             const newFrames = currentFrames - lastCheckedFrameCount;
             lastCheckedFrameCount = currentFrames;

             // Verificar video element
             const videoEl = document.getElementById('webgazerVideoFeed') as HTMLVideoElement | null;
             const videoStatus = videoEl ? {
                 paused: videoEl.paused,
                 readyState: videoEl.readyState,
                 videoWidth: videoEl.videoWidth,
                 videoHeight: videoEl.videoHeight,
                 srcObject: !!videoEl.srcObject,
                 muted: videoEl.muted,
                 currentTime: videoEl.currentTime?.toFixed(1),
             } : 'NO ENCONTRADO';

             // Silenciado el bloque gigante de diagnóstico
             if (newFrames === 0) {
                 // Solo loguear este error de UI cada 10 segundos
                 if (currentFrames % 5 === 0) {
                     this.logger('error', '⚠️ WebGazer no envía datos de gaze (pipeline detenido)');
                 }
             }
         }, 10000); // Revisar cada 10s en vez de 2s para no saturar
     }

    private stopDiagnosticLoop() {
        if (this.diagnosticInterval) {
            clearInterval(this.diagnosticInterval);
            this.diagnosticInterval = undefined;
        }
    }
}
