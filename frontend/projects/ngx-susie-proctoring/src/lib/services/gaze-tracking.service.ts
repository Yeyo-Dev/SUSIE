import { Injectable, signal, NgZone, DestroyRef, inject } from '@angular/core';

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

/** Métricas de calibración para verificar efectividad */
export interface GazeCalibrationMetrics {
    /** Total de clicks de calibración registrados */
    calibrationClicks: number;
    /** Frames de gaze procesados durante calibración */
    calibrationFrames: number;
    /** Frames de gaze procesados durante tracking */
    trackingFrames: number;
    /** Si WebGazer detectó cara exitosamente */
    faceDetected: boolean;
    /** Promedio de confianza de predicción (si está disponible) */
    avgConfidence: number | null;
    /** Timestamp de inicio de calibración */
    calibrationStartTime: number | null;
    /** Timestamp de completado de calibración */
    calibrationCompleteTime: number | null;
}

const DEFAULT_CONFIG: GazeConfig = {
    smoothingWindow: 10,
    deviationThreshold: 0.82, // Bajamos de 0.85 a 0.82 para mayor sensibilidad lateral
    deviationToleranceSeconds: 5,
    samplingIntervalMs: 1000,
};

/**
 * Filtro de Kalman minimalista para suavizado predictivo unidimensional.
 */
class SimpleKalmanFilter {
    private x: number = 0; // estado
    private p: number = 1; // error de estimación
    private initialized: boolean = false;

    constructor(
        private q: number, // varianza del proceso (ruido del modelo)
        private r: number, // varianza de la medición (ruido del sensor)
        private initialP: number = 1
    ) { }

    update(measurement: number): number {
        if (!this.initialized) {
            this.x = measurement;
            this.p = this.initialP;
            this.initialized = true;
            return this.x;
        }

        // Predicción
        this.p = this.p + this.q;

        // Actualización / Ganancia
        const k = this.p / (this.p + this.r);
        this.x = this.x + k * (measurement - this.x);
        this.p = (1 - k) * this.p;

        return this.x;
    }

    reset() {
        this.initialized = false;
    }
}

@Injectable({ providedIn: 'root' })
export class GazeTrackingService {
    /** Estado reactivo del servicio */
    readonly gazeState = signal<GazeState>('IDLE');

    /** Indica si la calibración fue completada exitosamente */
    readonly isCalibrated = signal(false);

    /** Último punto suavizado (para debug/UI) */
    readonly lastPoint = signal<GazePoint | null>(null);

    /** Si hay una desviación sostenida activa */
    readonly hasDeviation = signal(false);

    /** Indica si WebGazer está en proceso de inicialización */
    readonly isInitializing = signal(false);

    /** Indica si el rostro está detectado actualmente */
    readonly isFaceDetected = signal(true);

    /** Valor del contador de cuenta regresiva para pérdida de rostro */
    readonly countdownValue = signal(10);

    /** Si el overlay de cuenta regresiva debe ser visible */
    readonly isCountdownVisible = signal(false);

    private faceLossGraceTimer: any = null;
    private countdownInterval: any = null;

    private config: GazeConfig = { ...DEFAULT_CONFIG };
    private logger: (type: 'info' | 'error' | 'success' | 'warn', msg: string, details?: any) => void = () => { };
    private deviationCallback?: () => void;

    // Historial de suavizado
    private xHistory: number[] = [];
    private yHistory: number[] = [];

    // Buffer de coordenadas para telemetría (se envía con snapshots)
    private gazeBuffer: GazePoint[] = [];
    private maxBufferSize = 60; // ~60 segundos de datos a 1 muestra/seg

    // Detección de desviación sostenida
    private deviationStartTime: number | null = null;
    private deviationCheckInterval: any = null;

    // Referencia a WebGazer (se carga globalmente)
    private webgazer: any = null;

    // Contador de frames de gaze recibidos
    private gazeFrameCount = 0;
    private lastGazeLogTime = 0;

    // Filtros de Kalman para suavizado predictivo
    private kalmanX = new SimpleKalmanFilter(0.1, 0.4, 0.1);
    private kalmanY = new SimpleKalmanFilter(0.1, 0.4, 0.1);

    // Observer para silenciar videos de WebGazer
    private muteObserver: MutationObserver | null = null;
    private muteRetryInterval: any = null;

    // Diagnóstico para debugging
    private diagnosticInterval: any = null;

    // Polling manual de gaze (fallback cuando setGazeListener deja de funcionar)
    private pollingRafId: number | null = null;
    private lastPollTime = 0;

    // Métricas de calibración
    private calibrationClicks = 0;
    private calibrationFrames = 0;
    private trackingFrames = 0;
    private calibrationStartTime: number | null = null;
    private calibrationCompleteTime: number | null = null;
    private confidenceSum = 0;
    private confidenceCount = 0;

    private noFaceCallback?: () => void;

    // Detección de desviación - delay para evitar flapping
    private lastInBoundsTime: number | null = null;
    private readonly STABILITY_DELAY_MS = 500; // 500ms de delay antes de considerar estable

    private destroyRef = inject(DestroyRef);

    constructor(private ngZone: NgZone) { 
        // Exponer para debugging en consola del navegador
        (window as any).gazeService = this;
        this.destroyRef.onDestroy(() => this.stop());
    }

    /** Configura el servicio */
    configure(
        config: Partial<GazeConfig> = {},
        logger?: (type: 'info' | 'error' | 'success' | 'warn', msg: string, details?: any) => void,
        onDeviation?: () => void,
        onNoFace?: () => void
    ) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        if (logger) this.logger = logger;
        if (onDeviation) this.deviationCallback = onDeviation;
        if (onNoFace) this.noFaceCallback = onNoFace;
    }

    /**
     * Inicia WebGazer en modo calibración.
     * Acepta un MediaStream existente para evitar conflictos con getUserMedia.
     */
    async startCalibration(existingStream?: MediaStream | null): Promise<boolean> {
        if (this.isInitializing()) {
            console.log('[GAZE] WebGazer ya se está inicializando, ignorando llamada extra.');
            return false;
        }

        try {
            this.isInitializing.set(true);
            this.gazeState.set('CALIBRATING');
            this.resetCalibrationMetrics(); // Resetear métricas
            
            console.log('[GAZE] 🎯 Iniciando calibración de gaze...');
            this.logger('info', '🎯 Iniciando calibración de gaze...');
            
            // Inyectar estilos inmediatamente para prevenir parpadeo de cámara
            this.injectGazeStyles();
            
            this.webgazer = (window as any).webgazer;

            if (!this.webgazer) {
                this.logger('error', '❌ WebGazer no está cargado. Asegúrate de incluir webgazer.js');
                console.error('[GAZE] WebGazer no está disponible en window.webgazer');
                this.gazeState.set('ERROR');
                this.isInitializing.set(false);
                return false;
            }

            this.logger('info', '🔄 Iniciando WebGazer...');
            console.log('[GAZE] WebGazer encontrado, configurando...');

            // Iniciar observador agresivo de muting ANTES de begin()
            this.startAggressiveMuting();

            // Si tenemos un stream existente, monkey-patch getUserMedia
            // para que WebGazer lo reutilice en vez de abrir otra cámara
            const originalGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
            if (existingStream) {
                this.logger('info', '🔗 Inyectando stream existente para WebGazer...');
                navigator.mediaDevices.getUserMedia = () => Promise.resolve(existingStream);
            }

            // La detección de rostro se maneja ahora via handleNoFaceDetection y handleFaceDetected

            this.webgazer
                .setTracker('TFFacemesh')
                .setRegression('ridge')
                .setGazeListener((data: any, _clock: number) => {
                    // Contar TODOS los callbacks, incluyendo data=null
                    this.gazeFrameCount++;

                    if (!data) {
                        // WebGazer llama con null cuando no detecta rostro
                        // Solo procesar durante TRACKING (no durante calibración)
                        if (this.gazeState() === 'TRACKING') {
                            this.handleNoFaceDetection();
                        }
                        
                        if (this.gazeFrameCount % 30 === 0) {
                            console.log(`[GAZE] Frame #${this.gazeFrameCount} — data=null (no face detected)`);
                        }
                        return;
                    }

                    // Si hay datos de rostro, resetear el contador de "sin rostro"
                    this.handleFaceDetected();

                    if (this.gazeFrameCount <= 3) {
                        this.logger('success', `👁️ Dato de gaze #${this.gazeFrameCount} recibido de WebGazer`);
                        console.log(`[GAZE] ✅ Dato de gaze #${this.gazeFrameCount}:`, data);
                    }

                    // Log directo a consola cada 60 frames (~2s a 30fps)
                    if (this.gazeFrameCount % 60 === 0) {
                        console.log(`[GAZE] Frame #${this.gazeFrameCount} → x:${data.x?.toFixed(0)}, y:${data.y?.toFixed(0)}`);
                    }

                    // Actualizar nuestro punto rojo personalizado
                    let customDot = document.getElementById('customGazeDot');
                    if (!customDot) {
                        customDot = document.createElement('div');
                        customDot.id = 'customGazeDot';
                        customDot.style.position = 'fixed';
                        customDot.style.zIndex = '100000';
                        customDot.style.pointerEvents = 'none';
                        customDot.style.width = '20px';
                        customDot.style.height = '20px';
                        customDot.style.background = 'rgba(255, 0, 0, 0.8)';
                        customDot.style.border = '2px solid white';
                        customDot.style.borderRadius = '50%';
                        customDot.style.transform = 'translate(-50%, -50%)';
                        customDot.style.boxShadow = '0 0 10px rgba(0,0,0,0.5)';
                        document.body.appendChild(customDot);
                    }
                    customDot.style.left = `${data.x}px`;
                    customDot.style.top = `${data.y}px`;

                    // WebGazer puede devolver confidence en data.confidence o data.estimation?.confidence
                    const confidence = data.confidence ?? data.estimation?.confidence ?? null;
                    this.processRawGaze(data.x, data.y, confidence ?? undefined, data);
                });

            console.log('[GAZE] Llamando webgazer.begin()...');
            await this.webgazer.begin();

            // Restaurar getUserMedia original
            navigator.mediaDevices.getUserMedia = originalGetUserMedia;

            this.logger('info', '✅ WebGazer.begin() completado');
            console.log('[GAZE] ✅ webgazer.begin() completado exitosamente');

            // DURANTE CALIBRACIÓN: video semi-transparente para que el usuario vea los puntos de calibración
            // IMPORTANTE: debe ser visible para que WebGazer procese frames
            try {
                console.log('[GAZE] Configurando video preview...');
                this.webgazer.showVideoPreview(true).showPredictionPoints(true).showFaceOverlay(true);
                console.log('[GAZE] Video y puntos de calibración activados');

                this.applyGreenFaceOverlay();
            } catch (e) {
                console.warn('[GAZE] Error al configurar video preview:', e);
            }

            // Silenciar el video de WebGazer (forzar inmediatamente)
            this.muteAllWebgazerVideos();

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
     * Registra un punto de calibración (el usuario hace clic mirando un punto específico).
     * WebGazer aprende de la posición del clic + la posición de los ojos.
     */
    recordCalibrationClick(screenX: number, screenY: number) {
        if (!this.webgazer) return;
        
        // Contabilizamos el click
        this.calibrationClicks++;
        
        // WebGazer registra automáticamente los clics como datos de entrenamiento
        // Feedback claro al usuario
        const progress = this.calibrationClicks >= 9 ? '✅' : this.calibrationClicks >= 5 ? '🔄' : '⏳';
        const msg = `${progress} Click #${this.calibrationClicks} registrado en (${Math.round(screenX)}, ${Math.round(screenY)}) — WebGazer entrenando...`;
        this.logger('success', msg);
        console.log('[GAZE]', msg);
    }

    /**
     * Retorna las métricas actuales de calibración y tracking.
     */
    getCalibrationMetrics(): GazeCalibrationMetrics {
        const avgConfidence = this.confidenceCount > 0 
            ? this.confidenceSum / this.confidenceCount 
            : null;
            
        const duration = this.calibrationCompleteTime && this.calibrationStartTime
            ? this.calibrationCompleteTime - this.calibrationStartTime
            : null;

        return {
            calibrationClicks: this.calibrationClicks,
            calibrationFrames: this.calibrationFrames,
            trackingFrames: this.trackingFrames,
            faceDetected: this.gazeFrameCount > 0,
            avgConfidence,
            calibrationStartTime: this.calibrationStartTime,
            calibrationCompleteTime: this.calibrationCompleteTime,
        };
    }

    /**
     * Resetea las métricas de calibración.
     */
    private resetCalibrationMetrics() {
        this.calibrationClicks = 0;
        this.calibrationFrames = 0;
        this.trackingFrames = 0;
        this.calibrationStartTime = Date.now();
        this.calibrationCompleteTime = null;
        this.confidenceSum = 0;
        this.confidenceCount = 0;
    }

    /**
     * Marca la calibración como completada y comienza el tracking real.
     */
    completeCalibration() {
        this.isCalibrated.set(true);
        this.gazeState.set('TRACKING');
        this.xHistory = [];
        this.yHistory = [];
        this.gazeBuffer = [];
        this.calibrationCompleteTime = Date.now();

        // Log de métricas de calibración
        const metrics = this.getCalibrationMetrics();
        const duration = metrics.calibrationCompleteTime && metrics.calibrationStartTime
            ? ((metrics.calibrationCompleteTime - metrics.calibrationStartTime) / 1000).toFixed(1)
            : 'N/A';
            
        const quality = metrics.calibrationFrames >= 100 ? '🟢 Excelente' 
            : metrics.calibrationFrames >= 50 ? '🟡 Bueno'
            : metrics.calibrationFrames >= 20 ? '🟠 Regular'
            : '🔴 Insuficiente';
            
        this.logger('success', `📊 CALIBRACIÓN COMPLETA | Clicks: ${metrics.calibrationClicks} | Frames: ${metrics.calibrationFrames} | Duración: ${duration}s | ${quality}`);
        console.log(`[GAZE] 📊 CALIBRACIÓN COMPLETA | Clicks: ${metrics.calibrationClicks} | Frames: ${metrics.calibrationFrames} | Duración: ${duration}s | ${quality}`);

        console.log('[GAZE] completeCalibration() — Métricas:', metrics);

        if (this.webgazer) {
            // Intentar resume() por si WebGazer auto-pausó su loop
            try {
                if (typeof this.webgazer.resume === 'function') {
                    this.webgazer.resume();
                    console.log('[GAZE] webgazer.resume() llamado');
                }
            } catch (e) {
                console.warn('[GAZE] webgazer.resume() falló:', e);
            }

            // DURANTE EL EXAMEN: video casi invisible (opacity 0.001) pero activo para WebGazer
            // IMPORTANTE: NO usar opacity: 0 porque el navegador deja de procesarlo
            const wgContainer = document.getElementById('webgazerVideoContainer');
            const videoFeed = document.getElementById('webgazerVideoFeed') as HTMLVideoElement;
            
            if (wgContainer) {
                // Actualizar el estilo existente
                wgContainer.style.opacity = '0.001';
                wgContainer.style.visibility = 'visible';
                wgContainer.style.display = 'block';
                wgContainer.style.position = 'fixed';
                wgContainer.style.zIndex = '9999';
                wgContainer.style.pointerEvents = 'none';

                // Corner inferior derecho
                wgContainer.style.width = '160px';
                wgContainer.style.height = '120px';
                wgContainer.style.bottom = '10px';
                wgContainer.style.right = '10px';
                wgContainer.style.top = 'auto';
                wgContainer.style.left = 'auto';
                
                console.log('[GAZE] Video configurado (opacity: 0.001) durante examen');
            }
            
            if (videoFeed) {
                videoFeed.style.opacity = '0.001';
                if (videoFeed.paused) {
                    videoFeed.play().catch(e => console.warn('[GAZE] Error al hacer play:', e));
                }
                console.log('[GAZE] Video feed estado:', videoFeed.paused ? 'paused' : 'playing');
            }
            
            // Re-activar video preview de WebGazer para asegurar que procese
            try {
                this.webgazer.showVideo(true);
                console.log('[GAZE] showVideo(true) llamado');
            } catch (e) {
                console.warn('[GAZE] showVideo falló:', e);
            }

            // Mostrar el gaze dot durante el tracking para verificar precisión
            // Si la calibración funciona bien, el punto debería seguir tu mirada
            const gazeDot = document.getElementById('webgazerGazeDot');
            if (gazeDot) {
                gazeDot.style.display = 'block';
                gazeDot.style.width = '20px';
                gazeDot.style.height = '20px';
                gazeDot.style.background = 'rgba(0, 255, 0, 0.8)'; // Verde brillante
                gazeDot.style.border = '2px solid white';
                gazeDot.style.borderRadius = '50%';
                gazeDot.style.zIndex = '99999';
                console.log('[GAZE] 🎯 Punto de predicción visible (verde)');
            }

            // Mantener face overlay pero con color verde
            try {
                this.webgazer.showFaceOverlay(true);
                // Aplicar color verde después
                setTimeout(() => this.applyGreenFaceOverlay(), 500);
            } catch (e) {
                // ignore
            }
        }

        // El polling manual NO es necesario - el gaze listener ya proporciona datos
        // this.startManualPolling();

        // Iniciar chequeo de desviación periódico
        this.startDeviationDetection();

        // Iniciar diagnóstico
        this.startDiagnosticLoop();

        this.logger('success', '✅ Calibración completada — Tracking activo (polling manual)');
    }

    /**
     * Devuelve y limpia el buffer de coordenadas recientes (para enviar con snapshots).
     */
    flushGazeBuffer(): GazePoint[] {
        const snapshot = [...this.gazeBuffer];
        this.gazeBuffer = [];
        return snapshot;
    }

    /**
     * Obtiene el buffer actual sin limpiarlo (para lectura).
     */
    getGazeBuffer(): GazePoint[] {
        return [...this.gazeBuffer];
    }

    /**
     * Detiene todo: WebGazer, intervalos y limpia estado.
     */
    stop() {
        try {
            if (this.webgazer) {
                // Detener tracks de cámara manualmente para asegurar que el LED se apague
                const videoEl = document.getElementById('webgazerVideoFeed') as HTMLVideoElement;
                if (videoEl && videoEl.srcObject instanceof MediaStream) {
                    videoEl.srcObject.getTracks().forEach(track => track.stop());
                } else if (this.webgazer.util?.getMediaStream) {
                    const stream = this.webgazer.util.getMediaStream();
                    if (stream) stream.getTracks().forEach((t: any) => t.stop());
                }

                this.webgazer.end();
                this.webgazer = null;
            }
        } catch (e) {
            console.warn('[GAZE] Error al detener WebGazer:', e);
        }

        // Limpieza manual de elementos persistentes del DOM
        const elementsToPurge = [
            'webgazerVideoContainer', 
            'webgazerVideoFeed', 
            'webgazerFaceOverlay', 
            'webgazerGazeDot', 
            'webgazerFaceFeedbackBox', 
            'webgazerFaceAnnotations', 
            'customGazeDot',
            'webgazer-core-styles'
        ];
        
        elementsToPurge.forEach(id => {
            document.getElementById(id)?.remove();
        });

        this.cleanupInternalState();
        this.logger('info', '🛑 Gaze Tracking detenido');
    }

    /**
     * Limpia el estado interno, intervalos y observers.
     */
    private cleanupInternalState() {
        this.stopDeviationDetection();
        this.stopAggressiveMuting();
        this.stopDiagnosticLoop();
        this.stopManualPolling();
        
        this.gazeState.set('IDLE');
        this.isCalibrated.set(false);
        this.hasDeviation.set(false);
        this.lastPoint.set(null);

        const ghostStyle = document.getElementById('webgazer-ghost-style');
        if (ghostStyle) ghostStyle.remove();
        this.isInitializing.set(false);
        this.xHistory = [];
        this.yHistory = [];
        this.gazeBuffer = [];
        this.gazeFrameCount = 0;
        this.lastGazeLogTime = 0;
        this.resetFaceLossLogic();
        this.lastInBoundsTime = null;
    }

    /**
     * Inyecta estilos globales preventivos para evitar el parpadeo de la cámara
     * cuando WebGazer inyecta sus elementos en el DOM.
     */
    private injectGazeStyles() {
        const styleId = 'webgazer-core-styles';
        if (document.getElementById(styleId)) return;

        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            #webgazerVideoContainer, 
            #webgazerVideoFeed, 
            #webgazerFaceOverlay, 
            #webgazerFaceFeedbackBox, 
            #webgazerFaceAnnotations {
                opacity: 0.001 !important;
                transition: opacity 0.3s ease !important;
                pointer-events: none !important;
                z-index: 9999 !important;
                visibility: visible !important;
                display: block !important;
            }
            #webgazerFaceOverlay, #webgazerFaceFeedbackBox { 
                filter: hue-rotate(120deg) saturate(4) brightness(1.2) !important; 
            }
        `;
        document.head.appendChild(style);
        console.log('[GAZE] 🎨 Estilos preventivos inyectados (Ghost Mode)');
    }

    // ─── Internals ───────────────────────────────────────────

    /**
     * Maneja la detección de "sin rostro" durante el tracking.
     */
    private handleNoFaceDetection() {
        // Solo procesar si estamos en TRACKING y actualmente consideramos que hay rostro
        if (this.gazeState() !== 'TRACKING' || !this.isFaceDetected()) return;
        
        // Si ya hay timers corriendo, no hacer nada
        if (this.faceLossGraceTimer || this.countdownInterval) return;

        console.log('[GAZE] ⚠️ Rostro no detectado - Iniciando periodo de gracia de 3s');
        
        this.ngZone.run(() => {
            this.isFaceDetected.set(false);
        });

        // Iniciar periodo de gracia (3 segundos de silencio)
        this.faceLossGraceTimer = setTimeout(() => {
            this.ngZone.run(() => {
                this.isCountdownVisible.set(true);
                this.countdownValue.set(10); // Empezar countdown real tras los 3s de gracia
            });

            this.logger('warn', '⚠️ ROSTRO NO DETECTADO - Tienes 10 segundos para regresar');

            // Iniciar intervalo de cuenta regresiva
            this.countdownInterval = setInterval(() => {
                this.ngZone.run(() => {
                    const current = this.countdownValue();
                    if (current > 0) {
                        this.countdownValue.set(current - 1);
                    } else {
                        this.triggerFaceLossTimeout();
                    }
                });
            }, 1000);
        }, 3000);
    }

    /**
     * Maneja la redetección del rostro.
     */
    private handleFaceDetected() {
        // Si veníamos de una pérdida de rostro, resetear filtros para evitar "arrastre" de posición vieja
        if (!this.isFaceDetected()) {
            this.kalmanX.reset();
            this.kalmanY.reset();
        }

        console.log('[GAZE] ✅ Rostro detectado nuevamente');
        this.resetFaceLossLogic();
    }

    /**
     * Resetea toda la lógica de pérdida de rostro.
     */
    private resetFaceLossLogic() {
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

    /**
     * Dispara la infracción por tiempo prolongado sin rostro.
     */
    private triggerFaceLossTimeout() {
        console.log('[GAZE] ❌ INFRACCIÓN: Rostro no detectado por tiempo prolongado');
        this.logger('error', '❌ INFRACCIÓN: Rostro no detectado por tiempo prolongado');
        
        if (this.noFaceCallback) {
            this.noFaceCallback();
        }
        
        this.resetFaceLossLogic();
    }

    /**
     * Procesa coordenadas brutas del gaze listener de WebGazer.
     * Escala a [-1, 1], suaviza y almacena.
     */
    private processRawGaze(rawX: number, rawY: number, confidence?: number, rawData?: any) {
        const width = window.innerWidth;
        const height = window.innerHeight;

        // Escalar a [-1, 1] donde (0,0) es el centro
        const scaledX = (rawX / width) * 2 - 1;
        const scaledY = (rawY / height) * 2 - 1;

        // Contabilizar frames según el estado
        if (this.gazeState() === 'CALIBRATING') {
            this.calibrationFrames++;
        } else if (this.gazeState() === 'TRACKING') {
            this.trackingFrames++;
        }
        
        // Guardar confianza si está disponible
        if (confidence != null) {
            this.confidenceSum += confidence;
            this.confidenceCount++;
        }

        // STRICT FACE CHECK: Si la confianza es muy baja (< 0.6), tratar como pérdida de rostro rápida
        if (confidence != null && confidence < 0.6 && this.gazeState() === 'TRACKING') {
            this.handleNoFaceDetection();
            return;
        }

        // ORIENTATION CHECK (Yaw/Profile): Detectar si el usuario mira demasiado a los lados o arriba/abajo
        if (rawData?.allPredictions?.[0]?.scaledMesh) {
            const mesh = rawData.allPredictions[0].scaledMesh;
            const nose = mesh[1]; // Nariz
            const leftEdge = mesh[454]; // Borde izquierdo (sujeto)
            const rightEdge = mesh[234]; // Borde derecho (sujeto)
            const forehead = mesh[10]; // Frente
            const chin = mesh[152]; // Mentón

            if (nose && leftEdge && rightEdge) {
                const x1 = leftEdge[0];
                const x2 = rightEdge[0];
                const minX = Math.min(x1, x2);
                const maxX = Math.max(x1, x2);
                const faceWidth = maxX - minX;

                if (faceWidth > 0) {
                    // YAW (Horizontal): Posición relativa de la nariz (0 a 1)
                    const noseRelativeX = (nose[0] - minX) / faceWidth;
                    
                    // Incrementamos sensibilidad de 0.20 a 0.23 (más estricto hacia la izquierda/derecha)
                    if ((noseRelativeX < 0.23 || noseRelativeX > 0.77) && this.gazeState() === 'TRACKING') {
                        if (this.gazeFrameCount % 5 === 0) {
                            console.warn(`[GAZE] 🚨 Perfil (Yaw) detectado! relX: ${noseRelativeX.toFixed(2)}`);
                        }
                        this.handleNoFaceDetection();
                        return;
                    }
                }
            }

            if (nose && forehead && chin) {
                const minY = Math.min(forehead[1], chin[1]);
                const maxY = Math.max(forehead[1], chin[1]);
                const faceHeight = maxY - minY;

                if (faceHeight > 0) {
                    // PITCH (Vertical): Posición relativa de la nariz (0 a 1)
                    const noseRelativeY = (nose[1] - minY) / faceHeight;

                    // Mirar hacia abajo (noseRelativeY aumenta) — Umbral más estricto (0.64) para detectar mirada a teclado/celular
                    if ((noseRelativeY < 0.25 || noseRelativeY > 0.64) && this.gazeState() === 'TRACKING') {
                        if (this.gazeFrameCount % 5 === 0) {
                            console.warn(`[GAZE] 🚨 Perfil (Pitch) detectado! relY: ${noseRelativeY.toFixed(2)}`);
                        }
                        this.handleNoFaceDetection();
                        return;
                    }
                }
            }
        }

        // FILTRO DE KALMAN: Aplicar suavizado predictivo
        const filteredX = this.kalmanX.update(scaledX);
        const filteredY = this.kalmanY.update(scaledY);

        // Suavizar con ventana deslizante (opcional, ahora secundario al Kalman)
        this.xHistory.push(filteredX);
        this.yHistory.push(filteredY);

        if (this.xHistory.length > this.config.smoothingWindow) {
            this.xHistory.shift();
            this.yHistory.shift();
        }

        const avgX = this.xHistory.reduce((a, b) => a + b, 0) / this.xHistory.length;
        const avgY = this.yHistory.reduce((a, b) => a + b, 0) / this.yHistory.length;

        const point: GazePoint = {
            x: parseFloat(avgX.toFixed(3)),
            y: parseFloat(avgY.toFixed(3)),
            ts: Date.now(),
        };

        // Solo almacenar si estamos en TRACKING (no durante calibración)
        if (this.gazeState() === 'TRACKING') {
            this.ngZone.run(() => this.lastPoint.set(point));

            // Log periódico via logger (cada 3 segundos)
            const now = Date.now();
            if (now - this.lastGazeLogTime >= 3000) {
                this.lastGazeLogTime = now;
                this.logger('info', `👁️ Gaze: (${point.x}, ${point.y}) — frames: ${this.gazeFrameCount}, buffer: ${this.gazeBuffer.length}`);
            }

            if (this.gazeBuffer.length === 0 ||
                point.ts - this.gazeBuffer[this.gazeBuffer.length - 1].ts >= this.config.samplingIntervalMs) {
                this.gazeBuffer.push(point);

                // Mantener el buffer acotado
                if (this.gazeBuffer.length > this.maxBufferSize) {
                    this.gazeBuffer.shift();
                }
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

    /**
     * Inicia la detección de desviación sostenida.
     * Cada segundo verifica si el punto más reciente está fuera del umbral.
     */
    private startDeviationDetection() {
        this.stopDeviationDetection();

        this.deviationCheckInterval = setInterval(() => {
            const point = this.lastPoint();
            if (!point) return;

            const isOutOfBounds =
                Math.abs(point.x) > this.config.deviationThreshold ||
                Math.abs(point.y) > this.config.deviationThreshold;

            if (isOutOfBounds) {
                // Resetear el timer de "dentro" cuando sale
                this.lastInBoundsTime = null;
                
                if (!this.deviationStartTime) {
                    this.deviationStartTime = Date.now();
                    console.log('[GAZE] ⚠️ Mirada fuera de pantalla - iniciando contador');
                }

                const elapsed = (Date.now() - this.deviationStartTime) / 1000;

                // Log cada segundo mientras esté fuera
                if (Math.floor(elapsed) !== Math.floor(elapsed - 1)) {
                    const remaining = Math.max(0, Math.ceil(this.config.deviationToleranceSeconds - elapsed));
                    console.log(`[GAZE] ⚠️ Fuera de pantalla: ${elapsed.toFixed(1)}s (se activa alerta en ${remaining}s)`);
                }

                if (elapsed >= this.config.deviationToleranceSeconds && !this.hasDeviation()) {
                    this.ngZone.run(() => {
                        this.hasDeviation.set(true);
                        const msg = `🚨 GAZE_DEVIATION: Mirada fuera de pantalla por ${elapsed.toFixed(1)}s`;
                        this.logger('error', msg);
                        console.log('[GAZE]', msg);
                        this.deviationCallback?.();
                    });
                }
            } else {
                // Regresó al área segura - aplicar delay de estabilidad
                if (this.deviationStartTime) {
                    // Solo resetear si estuvo dentro por al menos 500ms
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
                                    console.log('[GAZE]', msg);
                                });
                            }
                        }
                    }
                }
            }
        }, 1000);
    }

    private stopDeviationDetection() {
        if (this.deviationCheckInterval) {
            clearInterval(this.deviationCheckInterval);
            this.deviationCheckInterval = null;
        }
        this.deviationStartTime = null;
    }

    /**
     * Silencia TODOS los videos de WebGazer en el DOM.
     */
    private muteAllWebgazerVideos() {
        // Silenciar video principal de WebGazer
        const videoEl = document.getElementById('webgazerVideoFeed') as HTMLVideoElement | null;
        if (videoEl) {
            videoEl.muted = true;
            videoEl.volume = 0;
            videoEl.setAttribute('muted', '');
            console.log('[GAZE] 🔇 webgazerVideoFeed silenciado');
        }

        // Silenciar TODOS los videos dentro del container de WebGazer
        const containers = ['webgazerVideoContainer', 'webgazerGazeDot'];
        containers.forEach(id => {
            const container = document.getElementById(id);
            if (container) {
                container.querySelectorAll('video').forEach(v => {
                    v.muted = true;
                    v.volume = 0;
                    v.setAttribute('muted', '');
                });
            }
        });

        // También buscar cualquier video en el body que NO tenga muted
        document.querySelectorAll('video').forEach(v => {
            if (!v.muted) {
                // Verificar si es un video de WebGazer (por su id o por estar en un container de webgazer)
                const isWebgazerVideo = v.id === 'webgazerVideoFeed' ||
                    v.closest('#webgazerVideoContainer') !== null;
                if (isWebgazerVideo) {
                    v.muted = true;
                    v.volume = 0;
                    v.setAttribute('muted', '');
                    console.log('[GAZE] 🔇 Video de WebGazer adicional silenciado:', v.id || '(sin id)');
                }
            }
        });
    }

    /**
     * Aplica color verde al face overlay de WebGazer.
     */
    private applyGreenFaceOverlay() {
        // WebGazer crea un canvas con el face overlay
        // Buscar el canvas y aplicar estilo verde
        const applyStyle = () => {
            const canvas = document.querySelector('#webgazerFaceOverlay') as HTMLCanvasElement;
            if (canvas) {
                // El overlay usa drawImage, necesitamos injectar CSS para el color
                const styleId = 'webgazer-green-overlay';
                if (!document.getElementById(styleId)) {
                    const style = document.createElement('style');
                    style.id = styleId;
                    style.textContent = `
                        #webgazerFaceOverlay, #webgazerFaceFeedbackBox, 
                        #webgazerFaceAnnotations, canvas[style*="face"] {
                            filter: drop-shadow(0 0 8px #00ff00) hue-rotate(120deg) saturate(4) brightness(1.2) !important;
                        }
                        .webgazer-face-overlay {
                            filter: drop-shadow(0 0 8px #00ff00) hue-rotate(120deg) saturate(4) !important;
                        }
                    `;
                    document.head.appendChild(style);
                    console.log('[GAZE] 🎨 Máscara verde aplicada');
                    
                    // También agregar estilo directamente al canvas
                    const style2 = document.createElement('style');
                    style2.textContent = `
                        canvas { 
                            filter: hue-rotate(120deg) saturate(4) !important;
                        }
                    `;
                    document.head.appendChild(style2);
                }
            }
        };

        // Intentar inmediatamente y luego retry
        applyStyle();
        setTimeout(applyStyle, 500);
        setTimeout(applyStyle, 1000);
        setTimeout(applyStyle, 2000);
    }

    /**
     * Inicia un MutationObserver para silenciar agresivamente
     * cualquier elemento <video> que WebGazer cree en el DOM.
     * Esto resuelve el problema de timing donde muteWebgazerVideo()
     * se ejecuta antes de que WebGazer cree su video.
     */
    private startAggressiveMuting() {
        this.stopAggressiveMuting();

        // MutationObserver: detectar cuando se añade un <video> al DOM
        this.muteObserver = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                for (const node of Array.from(mutation.addedNodes)) {
                    if (node instanceof HTMLVideoElement) {
                        node.muted = true;
                        node.volume = 0;
                        node.setAttribute('muted', '');
                        console.log('[GAZE] 🔇 Video nuevo detectado y silenciado:', node.id || '(sin id)');
                        this.logger('info', '🔇 Video de WebGazer silenciado automáticamente');
                    }
                    // También verificar si un container fue añadido que contiene videos
                    if (node instanceof HTMLElement) {
                        node.querySelectorAll('video').forEach(v => {
                            v.muted = true;
                            v.volume = 0;
                            v.setAttribute('muted', '');
                            console.log('[GAZE] 🔇 Video dentro de container nuevo silenciado:', v.id || '(sin id)');
                        });
                    }
                }
            }
        });

        this.muteObserver.observe(document.body, {
            childList: true,
            subtree: true
        });

        // También un intervalo de respaldo cada 500ms durante 10 segundos
        let retryCount = 0;
        this.muteRetryInterval = setInterval(() => {
            this.muteAllWebgazerVideos();
            retryCount++;
            if (retryCount >= 20) { // 10 segundos
                clearInterval(this.muteRetryInterval);
                this.muteRetryInterval = null;
            }
        }, 500);
    }

    /**
     * Detiene el observer y el intervalo de muting.
     */
    private stopAggressiveMuting() {
        if (this.muteObserver) {
            this.muteObserver.disconnect();
            this.muteObserver = null;
        }
        if (this.muteRetryInterval) {
            clearInterval(this.muteRetryInterval);
            this.muteRetryInterval = null;
        }
    }

    /**
     * Polling manual de predicciones de WebGazer.
     * Usa requestAnimationFrame + getCurrentPrediction() como fallback
     * cuando setGazeListener deja de disparar después de la calibración.
     */
    private startManualPolling() {
        this.stopManualPolling();
        console.log('[GAZE] Iniciando polling manual de gaze...');

        const poll = () => {
            if (this.gazeState() !== 'TRACKING') {
                console.log('[GAZE] Polling detenido — estado:', this.gazeState());
                return;
            }

            // Limitar a ~10 predicciones/segundo (cada 100ms)
            const now = Date.now();
            if (now - this.lastPollTime >= 100) {
                this.lastPollTime = now;

                if (this.webgazer) {
                    try {
                        // Intentar getCurrentPrediction (método común de WebGazer)
                        let prediction: any = null;

                        if (typeof this.webgazer.getCurrentPrediction === 'function') {
                            prediction = this.webgazer.getCurrentPrediction();
                        } else if (typeof this.webgazer.predict === 'function') {
                            prediction = this.webgazer.predict();
                        }

                        if (prediction && prediction.x != null && prediction.y != null) {
                            this.gazeFrameCount++;

                            if (this.gazeFrameCount <= 3) {
                                console.log(`[GAZE-POLL] ✅ Predicción #${this.gazeFrameCount}:`, prediction);
                                this.logger('success', `👁️ Gaze polling: dato #${this.gazeFrameCount}`);
                            }

                            if (this.gazeFrameCount % 30 === 0) {
                                console.log(`[GAZE-POLL] Frame #${this.gazeFrameCount} → x:${prediction.x.toFixed(2)}, y:${prediction.y.toFixed(2)}`);
                            }

                            const confidence = prediction.confidence ?? prediction.estimation?.confidence ?? null;
                            this.processRawGaze(prediction.x, prediction.y, confidence ?? undefined, prediction);
                        } else if (this.gazeFrameCount % 50 === 0) {
                            console.log('[GAZE-POLL] prediction=null (no face)');
                        }
                    } catch (e) {
                        if (this.gazeFrameCount % 100 === 0) {
                            console.warn('[GAZE-POLL] Error en polling:', e);
                        }
                    }
                }
            }

            this.pollingRafId = requestAnimationFrame(poll);
        };

        this.pollingRafId = requestAnimationFrame(poll);
    }

    private stopManualPolling() {
        if (this.pollingRafId !== null) {
            cancelAnimationFrame(this.pollingRafId);
            this.pollingRafId = null;
        }
    }

    private startDiagnosticLoop() {
        this.stopDiagnosticLoop();
        let lastCheckedFrameCount = this.gazeFrameCount;

        this.diagnosticInterval = setInterval(() => {
            const currentFrames = this.gazeFrameCount;
            const newFrames = currentFrames - lastCheckedFrameCount;
            lastCheckedFrameCount = currentFrames;

            if (newFrames === 0 && this.gazeState() === 'TRACKING') {
                if (currentFrames % 5 === 0) {
                    this.logger('error', '⚠️ WebGazer no envía datos de gaze (pipeline detenido)');
                }
            }
        }, 10000);
    }

    private stopDiagnosticLoop() {
        if (this.diagnosticInterval) {
            clearInterval(this.diagnosticInterval);
            this.diagnosticInterval = null;
        }
    }
}
