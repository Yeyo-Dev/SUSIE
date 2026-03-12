import { Injectable, DestroyRef, inject } from '@angular/core';
import { LoggerFn } from '@lib/models/contracts';
import { DestroyRefUtility } from '@lib/utils/destroy-ref.utility';

export type IntervalHandle = ReturnType<typeof setInterval>;

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
  private cleanup = inject(DestroyRefUtility);
  private logger: LoggerFn = () => {};

  private muteObserver: MutationObserver | null = null;
  private muteRetryInterval: IntervalHandle | undefined;

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
  start(): void {
    this.stop();

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

    let retryCount = 0;
    this.muteRetryInterval = this.cleanup.setInterval(() => {
      this.muteAllVideos();
      retryCount++;
      if (retryCount >= 20) {
        this.cleanup.clearInterval(this.muteRetryInterval as any);
        this.muteRetryInterval = undefined;
      }
    }, 500);

    this.logger('info', '🔇 MutationObserver de muting iniciado');
  }

  /**
   * Detiene la monitorización.
   */
  stop(): void {
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
   * Silencia todos los videos de WebGazer actuales en el DOM.
   * Se llama manualmente si es necesario.
   */
  muteNow(): void {
    const videoEl = document.getElementById('webgazerVideoFeed') as HTMLVideoElement | null;
    if (videoEl) {
      videoEl.muted = true;
      videoEl.volume = 0;
      videoEl.setAttribute('muted', '');
      console.log('[GAZE] 🔇 webgazerVideoFeed silenciado');
    }

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

    document.querySelectorAll('video').forEach(v => {
      if (!v.muted) {
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
   * Alias para compatibilidad
   */
  muteAllVideos(): void {
    this.muteNow();
  }

  /**
   * Limpia recursos del servicio.
   */
  destroy(): void {
    this.stop();
  }
}
