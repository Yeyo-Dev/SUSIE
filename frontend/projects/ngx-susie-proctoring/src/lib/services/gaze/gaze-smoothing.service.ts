import { Injectable } from '@angular/core';

/**
 * GazePoint - Coordenada suavizada de gaze tracking
 */
export interface GazePoint {
  x: number; // -1 (izquierda) a 1 (derecha), 0 = centro
  y: number; // -1 (arriba) a 1 (abajo), 0 = centro
  ts: number; // timestamp epoch ms
}

/**
 * GazeSmoothingService
 *
 * Responsabilidad: Suavizar y normalizar coordenadas de gaze.
 * - Recibe píxeles crudos de GazePredictionService
 * - Escala a [-1, 1]
 * - Aplica suavizado con ventana deslizante
 * - Emite puntos suavizados vía RxJS Observable
 *
 * Notas:
 * - Puramente matemático, sin dependencias de Angular internals
 * - Determinista (testeable)
 * - Emite pointSmoothed$ (implementar en Fase 3)
 */
@Injectable({ providedIn: 'root' })
export class GazeSmoothingService {
  private xHistory: number[] = [];
  private yHistory: number[] = [];
  private smoothingWindow: number = 10;

  constructor() {}

  /**
   * Configura el tamaño de la ventana de suavizado.
   *
   * @param windowSize - Cantidad de frames anteriores a promediar
   */
  setSmoothingWindow(windowSize: number): void {
    // TODO: Implement in Phase 3
    // - Guardar nuevo tamaño
    // - Limpiar históricos si es necesario
    throw new Error('Not implemented');
  }

  /**
   * Suaviza y normaliza coordenadas de gaze.
   * Entrada: píxeles crudos de pantalla
   * Salida: coordenadas normalizadas [-1, 1]
   *
   * @param rawX - Coordenada X en píxeles (sin normalizar)
   * @param rawY - Coordenada Y en píxeles (sin normalizar)
   * @returns GazePoint suavizado y normalizado
   */
  smoothAndNormalize(rawX: number, rawY: number): GazePoint {
    // TODO: Implement in Phase 3
    // - Escalar píxeles a [-1, 1]: (x / width) * 2 - 1
    // - Guardar en xHistory / yHistory
    // - Promediar ventana deslizante
    // - Retornar GazePoint con promedio, clipped a [-1, 1]
    throw new Error('Not implemented');
  }

  /**
   * Reinicia los históricos de suavizado.
   * Útil cuando se cambia de estado (calibración → tracking).
   */
  reset(): void {
    // TODO: Implement in Phase 3
    // - Limpiar xHistory
    // - Limpiar yHistory
    throw new Error('Not implemented');
  }

  /**
   * Obtiene el histórico actual de X (solo lectura).
   */
  getXHistory(): number[] {
    return [...this.xHistory];
  }

  /**
   * Obtiene el histórico actual de Y (solo lectura).
   */
  getYHistory(): number[] {
    return [...this.yHistory];
  }

  /**
   * Limpia recursos del servicio.
   */
  destroy(): void {
    // TODO: Implement in Phase 3
    // - Limpiar históricos
    throw new Error('Not implemented');
  }
}
