import { Injectable, DestroyRef, inject } from '@angular/core';
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
  private gazeFrameCount = 0;

  constructor() {}

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
    // TODO: Implement in Phase 2
    // - Guardar referencia a WebGazer
    // - Setear listener: webgazer.setGazeListener((data, clock) => { ... })
    // - Iniciar polling manual con RAF
    // - Emitir predictionReceived$ con datos crudos (x, y en píxeles)
    // - Marcar isTracking = true
    throw new Error('Not implemented');
  }

  /**
   * Detiene el tracking de predicciones.
   * Limpia listeners y RAF.
   */
  stopTracking(): void {
    // TODO: Implement in Phase 2
    // - Cancelar RAF polling
    // - Limpiar listener de WebGazer
    // - Marcar isTracking = false
    throw new Error('Not implemented');
  }

  /**
   * Setea un callback personalizado para cuando llegan predicciones.
   * Usado por el Facade para conectar con otros servicios.
   *
   * @param callback - Función que se ejecuta cuando llega una predicción
   */
  setGazeListener(callback: (data: WebGazerPrediction | null, clock: number) => void): void {
    // TODO: Implement in Phase 2
    // - Guardar callback
    // - Registrarlo con WebGazer
    throw new Error('Not implemented');
  }

  /**
   * Inicia polling manual con requestAnimationFrame.
   * Fallback cuando setGazeListener deja de funcionar después de calibración.
   */
  startManualPolling(): void {
    // TODO: Implement in Phase 2
    // - Implementar RAF loop
    // - Llamar webgazer.getCurrentPrediction()
    // - Throttle a ~10 predicciones/segundo (cada 100ms)
    throw new Error('Not implemented');
  }

  /**
   * Detiene el polling manual.
   */
  stopManualPolling(): void {
    // TODO: Implement in Phase 2
    // - Cancelar RAF
    throw new Error('Not implemented');
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
    // TODO: Implement in Phase 2
    throw new Error('Not implemented');
  }
}
