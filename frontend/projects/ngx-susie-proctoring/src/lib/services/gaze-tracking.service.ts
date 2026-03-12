import { Injectable, signal, NgZone, inject } from '@angular/core';
import { DestroyRefUtility } from '../utils/destroy-ref.utility';
import {
    LoggerFn,
    WebGazerAPI,
    WebGazerPrediction,
    IntervalHandle,
} from '../models/contracts';

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
    readonly hasDeviation = signal(false);

    private config: GazeConfig = { ...DEFAULT_CONFIG };
    private logger: LoggerFn = () => { };
    private deviationCallback?: () => void;

    // Historial de suavizado
    private xHistory: number[] = [];
    private yHistory: number[] = [];

    // Buffer de coordenadas para telemetría (se envía con snapshots)
    private gazeBuffer: GazePoint[] = [];
    private maxBufferSize = 60; // ~60 segundos de datos a 1 muestra/seg

    // Detección de desviación sostenida
      private deviationStartTime: number | null = null;
      private deviationCheckInterval: IntervalHandle | undefined;

      // Referencia a WebGazer (se carga globalmente)
      private webgazer: WebGazerAPI | null = null;

      // Contador de frames de gaze recibidos
      private gazeFrameCount = 0;
      private lastGazeLogTime = 0;

      // Observer para silenciar videos de WebGazer
      private muteObserver: MutationObserver | null = null;
      private muteRetryInterval: IntervalHandle | undefined;

      // Diagnóstico para debugging
      private diagnosticInterval: IntervalHandle | undefined;

    // Polling manual de gaze (fallback cuando setGazeListener deja de funcionar)
    private pollingRafId: number | null = null;
    private lastPollTime = 0;

    constructor(private ngZone: NgZone, private cleanup: DestroyRefUtility) { }

    /** Configura el servicio */
    configure(
        config: Partial<GazeConfig> = {},
        logger?: LoggerFn,
        onDeviation?: () => void
    ) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        if (logger) this.logger = logger;
        if (onDeviation) this.deviationCallback = onDeviation;
    }

    /**
     * Inicia WebGazer en modo calibración.
     * Acepta un MediaStream existente para evitar conflictos con getUserMedia.
     */
    async startCalibration(existingStream?: MediaStream | null): Promise<boolean> {
        try {
             this.gazeState.set('CALIBRATING');
             this.webgazer = (window as any).webgazer as WebGazerAPI;

              if (!this.webgazer) {
                 this.logger('error', '❌ WebGazer no está cargado. Asegúrate de incluir webgazer.js');
                 this.gazeState.set('ERROR');
                 return false;
             }

             this.logger('info', '🔄 Iniciando WebGazer...');
 
             // Iniciar observador agresivo de muting ANTES de begin()
            this.startAggressiveMuting();

            // Si tenemos un stream existente, monkey-patch getUserMedia
            // para que WebGazer lo reutilice en vez de abrir otra cámara
            const originalGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
            if (existingStream) {
                this.logger('info', '🔗 Inyectando stream existente para WebGazer...');
                navigator.mediaDevices.getUserMedia = () => Promise.resolve(existingStream);
            }

            this.webgazer
                .setTracker('TFFacemesh')
                .setRegression('ridge')
                .setGazeListener((data: WebGazerPrediction | null, _clock: number) => {
                    // Contar TODOS los callbacks, incluyendo data=null
                    this.gazeFrameCount++;

                    if (!data) {
                        // WebGazer llama con null cuando no detecta rostro
                        if (this.gazeFrameCount % 30 === 0) {
                            console.log(`[GAZE] Frame #${this.gazeFrameCount} — data=null (no face detected)`);
                        }
                        return;
                    }

                    if (this.gazeFrameCount <= 3) {
                        this.logger('success', `👁️ Dato de gaze #${this.gazeFrameCount} recibido de WebGazer`);
                        console.log(`[GAZE] ✅ Dato de gaze #${this.gazeFrameCount}:`, data);
                    }

                    // Log directo a consola cada 60 frames (~2s a 30fps)
                    if (this.gazeFrameCount % 60 === 0) {
                        console.log(`[GAZE] Frame #${this.gazeFrameCount} → x:${data.x?.toFixed(0)}, y:${data.y?.toFixed(0)}`);
                    }

                    this.processRawGaze(data.x, data.y);
                });

            console.log('[GAZE] Llamando webgazer.begin()...');
            await this.webgazer.begin();

            // Restaurar getUserMedia original
            navigator.mediaDevices.getUserMedia = originalGetUserMedia;

            this.logger('info', '✅ WebGazer.begin() completado');
            console.log('[GAZE] ✅ webgazer.begin() completado exitosamente');

            // Mostrar video y predicciones durante la calibración
             try {
                 this.webgazer.showVideoPreview(true).showPredictionPoints(true);
             } catch (e) {
                 this.logger('error', 'Error al configurar video preview:', e);
             }

            // Silenciar el video de WebGazer (forzar inmediatamente)
            this.muteAllWebgazerVideos();

            this.logger('success', '👁️ WebGazer iniciado — Haz clic en los puntos rojos mirándolos fijamente');
            return true;
        } catch (error) {
            this.logger('error', '❌ Error al iniciar WebGazer', error);
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
     */
    completeCalibration() {
        this.isCalibrated.set(true);
        this.gazeState.set('TRACKING');
        this.xHistory = [];
        this.yHistory = [];
        this.gazeBuffer = [];

        console.log('[GAZE] completeCalibration() — gazeFrameCount:', this.gazeFrameCount);

        if (this.webgazer) {
            // Intentar resume() por si WebGazer auto-pausó su loop
            try {
                 if (typeof this.webgazer.resume === 'function') {
                     this.webgazer.resume();
                 }
             } catch (e) {
                 this.logger('error', 'Error al reanudar WebGazer:', e);
             }

            // Listar métodos disponibles en webgazer para diagnóstico
            // console.log('[GAZE] Métodos disponibles en webgazer:', methods.join(', '));

            // ESTRATEGIA DEFINITIVA: 
            // Los navegadores modernos detienen el pipeline de video si detectan que no es visible
            // (opacity=0, visibility=hidden, display=none, o a traves de la API del canvas).
            // Solución: Dejarlo 100% visible, pero renderizado fuera de la pantalla.
            const wgContainer = document.getElementById('webgazerVideoContainer');
            if (wgContainer) {
                // Restaurar cualquier intento anterior
                wgContainer.style.opacity = '1';
                wgContainer.style.visibility = 'visible';
                wgContainer.style.display = 'block';

                // Moverlo fuera de la pantalla
                wgContainer.style.position = 'fixed';
                wgContainer.style.top = '-9999px';
                wgContainer.style.left = '-9999px';
                wgContainer.style.pointerEvents = 'none';
            }

            const gazeDot = document.getElementById('webgazerGazeDot');
            if (gazeDot) {
                gazeDot.style.display = 'none';
            }
        }

        // Iniciar polling manual de predicciones
        // No depende de setGazeListener — llama directamente a getCurrentPrediction()
        this.startManualPolling();

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
                this.webgazer.end();
                this.webgazer = null;
            }
        } catch {
            // WebGazer puede fallar al detenerse si ya fue destruido
        }

        this.stopDeviationDetection();
        this.stopAggressiveMuting();
        this.stopDiagnosticLoop();
        this.stopManualPolling();
        this.gazeState.set('IDLE');
        this.isCalibrated.set(false);
        this.hasDeviation.set(false);
        this.lastPoint.set(null);
        this.xHistory = [];
        this.yHistory = [];
        this.gazeBuffer = [];
        this.gazeFrameCount = 0;
        this.lastGazeLogTime = 0;

        this.logger('info', '🛑 Gaze Tracking detenido');
    }

    // ─── Internals ───────────────────────────────────────────

    /**
     * Procesa coordenadas brutas del gaze listener de WebGazer.
     * Escala a [-1, 1], suaviza y almacena.
     */
    private processRawGaze(rawX: number, rawY: number) {
        const width = window.innerWidth;
        const height = window.innerHeight;

        // Escalar a [-1, 1] donde (0,0) es el centro
        const scaledX = (rawX / width) * 2 - 1;
        const scaledY = (rawY / height) * 2 - 1;

        // Suavizar con ventana deslizante
        this.xHistory.push(scaledX);
        this.yHistory.push(scaledY);

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

         this.deviationCheckInterval = this.cleanup.setInterval(() => {
             const point = this.lastPoint();
             if (!point) return;

             const isOutOfBounds =
                 Math.abs(point.x) > this.config.deviationThreshold ||
                 Math.abs(point.y) > this.config.deviationThreshold;

             if (isOutOfBounds) {
                 if (!this.deviationStartTime) {
                     this.deviationStartTime = Date.now();
                 }

                 const elapsed = (Date.now() - this.deviationStartTime) / 1000;

                 if (elapsed >= this.config.deviationToleranceSeconds && !this.hasDeviation()) {
                     this.ngZone.run(() => {
                         this.hasDeviation.set(true);
                         this.logger('error', `🚨 GAZE_DEVIATION: Mirada fuera de pantalla por ${elapsed.toFixed(1)}s`);
                         this.deviationCallback?.();
                     });
                 }
             } else {
                 // Regresó al área segura
                 if (this.deviationStartTime) {
                     this.deviationStartTime = null;
                     if (this.hasDeviation()) {
                         this.ngZone.run(() => {
                             this.hasDeviation.set(false);
                             this.logger('info', '👁️ Mirada regresó al área de pantalla');
                         });
                     }
                 }
             }
         }, 1000);
     }

    private stopDeviationDetection() {
        if (this.deviationCheckInterval) {
            clearInterval(this.deviationCheckInterval);
            this.deviationCheckInterval = undefined;
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
         this.muteRetryInterval = this.cleanup.setInterval(() => {
             this.muteAllWebgazerVideos();
             retryCount++;
             if (retryCount >= 20) { // 10 segundos
                 this.cleanup.clearInterval(this.muteRetryInterval as any);
                 this.muteRetryInterval = undefined;
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
            this.muteRetryInterval = undefined;
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
                         let prediction: WebGazerPrediction | null = null;

                         if (typeof this.webgazer.getCurrentPrediction === 'function') {
                             prediction = this.webgazer.getCurrentPrediction();
                         } else if (typeof (this.webgazer as any).predict === 'function') {
                             prediction = (this.webgazer as any).predict();
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

                                 this.processRawGaze(prediction.x, prediction.y);
                             } else if (this.gazeFrameCount % 50 === 0) {
                                 // No face detected - expected occasionally
                             }
                     } catch (e) {
                         if (this.gazeFrameCount % 100 === 0) {
                             this.logger('error', 'Error en polling de gaze:', e);
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

    /**
     * Diagnóstico: verifica cada 2s que WebGazer sigue procesando frames.
     * Logs directos a console.log para máxima visibilidad.
     */
     private startDiagnosticLoop() {
         this.stopDiagnosticLoop();

         let lastCheckedFrameCount = this.gazeFrameCount;

         this.diagnosticInterval = this.cleanup.setInterval(() => {
             const wg = this.webgazer;
             const currentFrames = this.gazeFrameCount;
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
