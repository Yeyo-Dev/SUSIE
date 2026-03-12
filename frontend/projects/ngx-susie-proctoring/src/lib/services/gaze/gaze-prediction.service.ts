import { Injectable, DestroyRef, inject } from '@angular/core';
import { Subject } from 'rxjs';
import { LoggerFn, WebGazerAPI, WebGazerPrediction } from '@lib/models/contracts';

/**
 * GazePredictionService
 *
 * Responsabilidad: Capturar y procesar predicciones de gaze en tiempo real.
 * - Setea el listener de WebGazer para datos en tiempo real
 * - Mantiene polling manual (RAF) como fallback
 * - Emite datos crudos (píxeles) vía RxJS Observable
 *
 * Notas:
 * - Recibe WebGazer del CalibrationService (inyectado por Facade)
 * - NO suaviza ni agrega datos — eso es responsabilidad de GazeSmoothingService
 * - Emite eventos predictionReceived$ (implementar en Fase 2)
 */
@Injectable({ providedIn: 'root' })
export class GazePredictionService {
  private destroyRef = inject(DestroyRef);
  private logger: LoggerFn = () => {};

  private webgazer: WebGazerAPI | null = null;
  private isTracking = false;
  private pollingRafId: number | null = null;
  private lastPollTime = 0;
  private gazeFrameCount = 0;
  private customListener: ((data: WebGazerPrediction | null, clock: number) => void) | null = null;

  private predictionSubject = new Subject<WebGazerPrediction>();
  predictionReceived$ = this.predictionSubject.asObservable();

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.destroy();
    });
  }

  /**
   * Configura el logger para este servicio
   */
  setLogger(logger: LoggerFn): void {
    this.logger = logger;
  }

  /**
   * Inicia el tracking de predicciones de gaze.
   * Debe llamarse DESPUÉS de que CalibrationService haya completado calibración.
   *
   * @param webgazer - Instancia de WebGazer (obtenida del CalibrationService)
   */
  async startTracking(webgazer: WebGazerAPI): Promise<void> {
    this.webgazer = webgazer;
    this.isTracking = true;
    this.gazeFrameCount = 0;
    this.lastPollTime = 0;

    if (this.customListener) {
      webgazer.setGazeListener(this.customListener);
    }

    this.startManualPolling();
  }

  /**
   * Detiene el tracking de predicciones.
   * Limpia listeners y RAF.
   */
  stopTracking(): void {
    this.isTracking = false;
    this.stopManualPolling();

    if (this.webgazer) {
      try {
        this.webgazer.setGazeListener(() => {});
      } catch {
        // Ignore errors when clearing listener
      }
    }

    this.webgazer = null;
  }

  /**
   * Setea un callback personalizado para cuando llegan predicciones.
   * Usado por el Facade para conectar con otros servicios.
   *
   * @param callback - Función que se ejecuta cuando llega una predicción
   */
  setGazeListener(callback: (data: WebGazerPrediction | null, clock: number) => void): void {
    this.customListener = callback;

    if (this.webgazer && this.isTracking) {
      this.webgazer.setGazeListener(callback);
    }
  }

  /**
   * Inicia polling manual con requestAnimationFrame.
   * Fallback cuando setGazeListener deja de funcionar después de calibración.
   */
  startManualPolling(): void {
    this.stopManualPolling();

    const poll = () => {
      if (!this.isTracking || !this.webgazer) {
        return;
      }

      const now = Date.now();
      if (now - this.lastPollTime >= 100) {
        this.lastPollTime = now;

        try {
          let prediction: WebGazerPrediction | null = null;

          if (typeof this.webgazer.getCurrentPrediction === 'function') {
            prediction = this.webgazer.getCurrentPrediction();
          } else if (typeof (this.webgazer as any).predict === 'function') {
            prediction = (this.webgazer as any).predict();
          }

          if (prediction && prediction.x != null && prediction.y != null) {
            this.gazeFrameCount++;
            this.predictionSubject.next(prediction);
          }
        } catch {
          // Silently ignore polling errors
        }
      }

      this.pollingRafId = requestAnimationFrame(poll);
    };

    this.pollingRafId = requestAnimationFrame(poll);
  }

  /**
   * Detiene el polling manual.
   */
  stopManualPolling(): void {
    if (this.pollingRafId !== null) {
      cancelAnimationFrame(this.pollingRafId);
      this.pollingRafId = null;
    }
  }

  /**
   * Obtiene el recuento de frames de gaze recibidos.
   * Útil para debugging.
   */
  getFrameCount(): number {
    return this.gazeFrameCount;
  }

  /**
   * Limpia recursos del servicio.
   */
  destroy(): void {
    this.stopTracking();
    this.predictionSubject.complete();
    this.customListener = null;
  }
}
