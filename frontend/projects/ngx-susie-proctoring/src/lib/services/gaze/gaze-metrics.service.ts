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
    // TODO: Implement in Phase 4
    // - Guardar nuevo tamaño
    // - Recortar buffer si excede nuevo tamaño
    throw new Error('Not implemented');
  }

  /**
   * Registra un punto suavizado en el buffer.
   * Si el buffer está lleno, elimina el punto más antiguo.
   *
   * @param point - GazePoint a registrar
   */
  recordPoint(point: GazePoint): void {
    // TODO: Implement in Phase 4
    // - Agregar punto al buffer
    // - Si buffer > maxBufferSize, quitar el primero
    throw new Error('Not implemented');
  }

  /**
   * Obtiene el buffer actual sin modificarlo.
   * Útil para lectura de estado actual.
   */
  getBuffer(): GazePoint[] {
    return [...this.gazeBuffer];
  }

  /**
   * Vaciá el buffer y retorna todos los puntos acumulados.
   * Se llama cuando se envía un snapshot de evidencia.
   *
   * @returns Array de todos los puntos acumulados
   */
  flushBuffer(): GazePoint[] {
    const snapshot = [...this.gazeBuffer];
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
    // TODO: Implement in Phase 4
    // - Calcular min/max/avg de X e Y en el buffer
    // - Retornar objeto con estadísticas
    throw new Error('Not implemented');
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
    // TODO: Implement in Phase 4
    // - Limpiar buffer
    throw new Error('Not implemented');
  }
}
