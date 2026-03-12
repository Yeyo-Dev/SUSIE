import { Injectable, DestroyRef, inject } from '@angular/core';
import { LoggerFn } from '@lib/models/contracts';

/**
 * GazeWebGazerMutingService
 *
 * Responsabilidad: Encapsular el hack de silenciar videos de WebGazer.
 * - WebGazer crea elementos <video> en el DOM durante calibración
 * - Los navegadores modernos pueden reproducir sonido por defecto
 * - Este servicio asegura que todos los videos están silenciados
 *
 * Notas:
 * - Este es un servicio de INFRAESTRUCTURA, no de negocio
 * - Es un workaround: si WebGazer cambia, este servicio se reemplaza fácilmente
 * - Usa MutationObserver + intervalo fallback para máxima robustez
 *
 * Implementación: Fase 6
 */
@Injectable({ providedIn: 'root' })
export class GazeWebGazerMutingService {
  private destroyRef = inject(DestroyRef);
  private logger: LoggerFn = () => {};

  private muteObserver: MutationObserver | null = null;
  private muteRetryInterval: any = undefined;

  constructor() {}

  /**
   * Configura el logger para este servicio
   */
  setLogger(logger: LoggerFn): void {
    this.logger = logger;
  }

  /**
   * Inicia la monitorización agresiva de silenciado.
   * Setea MutationObserver + intervalo de respaldo.
   */
  startMuting(): void {
    // TODO: Implement in Phase 6
    // - Crear MutationObserver que observe document.body
    // - Cuando se añada un <video>, mutearlo inmediatamente
    // - Setear intervalo fallback cada 500ms para 10 segundos
    // - Emitir logs vía logger
    throw new Error('Not implemented');
  }

  /**
   * Detiene la monitorización.
   */
  stopMuting(): void {
    // TODO: Implement in Phase 6
    // - Desconectar observer
    // - Cancelar intervalo
    throw new Error('Not implemented');
  }

  /**
   * Silencia todos los videos de WebGazer actuales en el DOM.
   * Se llama manualmente si es necesario.
   */
  muteAllVideos(): void {
    // TODO: Implement in Phase 6
    // - Buscar #webgazerVideoFeed y silenciarlo
    // - Buscar todos los <video> en containers de WebGazer
    // - Verificar otros videos en el DOM que pertenezcan a WebGazer
    // - Setear muted=true, volume=0, setAttribute('muted', '')
    throw new Error('Not implemented');
  }

  /**
   * Limpia recursos del servicio.
   */
  destroy(): void {
    // TODO: Implement in Phase 6
    // - Llamar stopMuting()
    throw new Error('Not implemented');
  }
}
