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
    this.smoothingWindow = windowSize;
    if (this.xHistory.length > windowSize) {
      this.xHistory = this.xHistory.slice(-windowSize);
      this.yHistory = this.yHistory.slice(-windowSize);
    }
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
    const width = window.innerWidth;
    const height = window.innerHeight;

    const scaledX = (rawX / width) * 2 - 1;
    const scaledY = (rawY / height) * 2 - 1;

    this.xHistory.push(scaledX);
    this.yHistory.push(scaledY);

    if (this.xHistory.length > this.smoothingWindow) {
      this.xHistory.shift();
      this.yHistory.shift();
    }

    const avgX = this.xHistory.reduce((a, b) => a + b, 0) / this.xHistory.length;
    const avgY = this.yHistory.reduce((a, b) => a + b, 0) / this.yHistory.length;

    return {
      x: parseFloat(Math.max(-1, Math.min(1, avgX)).toFixed(3)),
      y: parseFloat(Math.max(-1, Math.min(1, avgY)).toFixed(3)),
      ts: Date.now(),
    };
  }

  /**
   * Reinicia los históricos de suavizado.
   * Útil cuando se cambia de estado (calibración → tracking).
   */
  reset(): void {
    this.xHistory = [];
    this.yHistory = [];
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
    this.xHistory = [];
    this.yHistory = [];
  }
}
