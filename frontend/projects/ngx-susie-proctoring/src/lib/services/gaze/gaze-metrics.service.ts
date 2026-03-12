import { Injectable } from '@angular/core';
import type { GazePoint } from './gaze-smoothing.service';

/**
 * GazeMetricsService
 *
 * Responsabilidad: Agregar y almacenar puntos suavizados para telemetría.
 * - Recibe puntos suavizados de GazeSmoothingService
 * - Mantiene un buffer circular de últimos N puntos
 * - Proporciona flush (vaciar + retornar) y lectura del buffer
 * - Calcula estadísticas básicas (para debugging)
 *
 * Notas:
 * - El buffer se envía con snapshots de evidencia
 * - Puramente acumulador, sin lógica compleja
 * - Emite recordingComplete$ cuando buffer está lleno (implementar en Fase 4)
 */
@Injectable({ providedIn: 'root' })
export class GazeMetricsService {
  private gazeBuffer: GazePoint[] = [];
  private maxBufferSize: number = 60; // ~60 segundos de datos a 1 muestra/seg

  constructor() {}

  /**
   * Configura el tamaño máximo del buffer.
   *
   * @param size - Cantidad máxima de puntos a acumular
   */
  setMaxBufferSize(size: number): void {
    this.maxBufferSize = size;
    if (this.gazeBuffer.length > size) {
      this.gazeBuffer = this.gazeBuffer.slice(-size);
    }
  }

  /**
   * Registra un punto suavizado en el buffer.
   * Si el buffer está lleno, elimina el punto más antiguo.
   *
   * @param point - GazePoint a registrar
   */
  recordPoint(point: GazePoint): void {
    this.gazeBuffer.push(point);
    if (this.gazeBuffer.length > this.maxBufferSize) {
      this.gazeBuffer.shift();
    }
  }

  /**
   * Obtiene el buffer actual sin modificarlo.
   * Útil para lectura de estado actual.
   */
  getBuffer(): GazePoint[] {
    return this.gazeBuffer.map(p => ({ ...p }));
  }

  /**
   * Vaciá el buffer y retorna todos los puntos acumulados.
   * Se llama cuando se envía un snapshot de evidencia.
   *
   * @returns Array de todos los puntos acumulados
   */
  flushBuffer(): GazePoint[] {
    const snapshot = this.gazeBuffer.map(p => ({ ...p }));
    this.gazeBuffer = [];
    return snapshot;
  }

  /**
   * Calcula estadísticas básicas del buffer actual.
   * Útil para debugging y monitoreo.
   */
  getMetrics(): {
    count: number;
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    avgX: number;
    avgY: number;
  } {
    if (this.gazeBuffer.length === 0) {
      return {
        count: 0,
        minX: 0,
        maxX: 0,
        minY: 0,
        maxY: 0,
        avgX: 0,
        avgY: 0,
      };
    }

    const xs = this.gazeBuffer.map(p => p.x);
    const ys = this.gazeBuffer.map(p => p.y);

    return {
      count: this.gazeBuffer.length,
      minX: Math.min(...xs),
      maxX: Math.max(...xs),
      minY: Math.min(...ys),
      maxY: Math.max(...ys),
      avgX: xs.reduce((a, b) => a + b, 0) / xs.length,
      avgY: ys.reduce((a, b) => a + b, 0) / ys.length,
    };
  }

  /**
   * Limpia el buffer manualmente.
   */
  clear(): void {
    this.gazeBuffer = [];
  }

  /**
   * Limpia recursos del servicio.
   */
  destroy(): void {
    this.gazeBuffer = [];
  }
}
