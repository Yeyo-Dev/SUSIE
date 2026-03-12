import { Injectable, DestroyRef, inject, NgZone } from '@angular/core';
import { Subject } from 'rxjs';
import { LoggerFn, WebGazerAPI, WebGazerPrediction, IntervalHandle } from '@lib/models/contracts';

/**
 * Resultado de la calibración completada
 */
export interface CalibrationResult {
  success: boolean;
  pointsRecorded: number;
  webgazer: WebGazerAPI | null;
  error?: string;
}

/**
 * Estado de calibración
 */
export type CalibrationStatus = 'idle' | 'in-progress' | 'completed' | 'error';

/**
 * GazeCalibrationService — Fase 1: Extracción de lógica de calibración
 *
 * Responsabilidad: Gestionar el proceso de calibración inicial de WebGazer.
 * - Inicializa WebGazer en modo calibración
 * - Registra puntos de calibración (feedback visual)
 * - Completa el proceso y devuelve la referencia a WebGazer
 * - Maneja limpieza de recursos
 *
 * Notas importantes:
 * - NO mantiene estado de tracking en tiempo real
 * - Emite eventos vía RxJS Subjects para notificar al Facade
 * - Inyecta NgZone para ejecutar callbacks fuera de la zona Angular cuando sea necesario
 * - Usa DestroyRef para cleanup automático
 *
 * Dependencias inyectadas:
 * - NgZone: para escapar/entrar zona Angular
 * - DestroyRef: para gestión automática de cleanup
 *
 * Métodos públicos:
 * - setLogger(logger): Configura el logger
 * - startCalibration(existingStream?): Inicia WebGazer
 * - recordCalibrationClick(x, y): Registra clic de calibración
 * - completeCalibration(): Marca como completada
 * - resetCalibration(): Reinicia el estado
 * - destroy(): Limpia recursos
 *
 * Observables salientes:
 * - calibrationCompleted$: Emite cuando calibración termina exitosamente
 * - calibrationError$: Emite cuando hay error
 */
@Injectable({ providedIn: 'root' })
export class GazeCalibrationService {
  private destroyRef = inject(DestroyRef);
  private ngZone = inject(NgZone);
  private logger: LoggerFn = () => {};

  // Estado interno de calibración
  private calibrationStatus: CalibrationStatus = 'idle';
  private webgazer: WebGazerAPI | null = null;
  private gazeFrameCount = 0;
  private lastGazeLogTime = 0;
  private calibrationPointsRecorded = 0;

  // Original getUserMedia (para restaurar después del monkey-patch)
  private originalGetUserMedia: ((constraints: MediaStreamConstraints) => Promise<MediaStream>) | null = null;

  // Observables para notificar al Facade
  readonly calibrationCompleted$ = new Subject<CalibrationResult>();
  readonly calibrationError$ = new Subject<string>();

  constructor() {}

  /**
   * Configura el logger para este servicio
   */
  setLogger(logger: LoggerFn): void {
    this.logger = logger;
  }

  /**
   * Obtiene el estado actual de calibración
   */
  getStatus(): CalibrationStatus {
    return this.calibrationStatus;
  }

  /**
   * Inicia el proceso de calibración de WebGazer.
   * Retorna true si la inicialización fue exitosa.
   *
   * Pasos:
   * 1. Obtener WebGazer de window.webgazer
   * 2. Verificar que esté cargado (error si no)
   * 3. Monkey-patch getUserMedia si existe un stream existente
   * 4. Configurar tracker y regression
   * 5. Llamar webgazer.begin()
   * 6. Configurar video preview y prediction points
   * 7. Silenciar agresivamente los videos (workaround WebGazer)
   *
   * @param existingStream - MediaStream existente (opcional) para evitar múltiples getUserMedia
   * @returns true si la inicialización fue exitosa, false en caso contrario
   */
  async startCalibration(existingStream?: MediaStream | null): Promise<boolean> {
    try {
      this.calibrationStatus = 'in-progress';

      // Obtener WebGazer de window
      this.webgazer = (window as any).webgazer as WebGazerAPI;

      if (!this.webgazer) {
        const errorMsg = '❌ WebGazer no está cargado. Asegúrate de incluir webgazer.js';
        this.logger('error', errorMsg);
        this.calibrationStatus = 'error';
        this.calibrationError$.next(errorMsg);
        return false;
      }

      this.logger('info', '🔄 Iniciando WebGazer...');

      // Si tenemos un stream existente, monkey-patch getUserMedia
      // para que WebGazer lo reutilice en vez de abrir otra cámara
      this.originalGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);

      if (existingStream) {
        this.logger('info', '🔗 Inyectando stream existente para WebGazer...');
        navigator.mediaDevices.getUserMedia = () => Promise.resolve(existingStream);
      }

      // Configurar tracker y regression
      this.webgazer
        .setTracker('TFFacemesh')
        .setRegression('ridge')
        .setGazeListener((data: WebGazerPrediction | null, _clock: number) => {
          this.ngZone.runOutsideAngular(() => {
            this.handleGazeData(data);
          });
        });

      this.logger('info', '🔄 Llamando webgazer.begin()...');
      console.log('[GAZE] Llamando webgazer.begin()...');

      await this.webgazer.begin();

      // WebGazer añade los event listeners del mouse por defecto al iniciar.
      // Los removemos AHORA para que el punto no siga al ratón.
      this.webgazer.removeMouseEventListeners();

      // Restaurar getUserMedia original
      if (this.originalGetUserMedia) {
        navigator.mediaDevices.getUserMedia = this.originalGetUserMedia;
      }

      this.logger('info', '✅ WebGazer.begin() completado');
      console.log('[GAZE] ✅ webgazer.begin() completado exitosamente');

      // Mostrar video y predicciones durante la calibración
      try {
        this.webgazer
          .showVideoPreview(true)
          .showPredictionPoints(true)
          .showFaceOverlay(true)
          .showFaceFeedbackBox(true);

        // La UI de calibración tiene un z-index de 9999 y fondo opaco.
        // Forzamos el contenedor de video a 10000 para que la malla facial se vea.
        const wgContainer = document.getElementById('webgazerVideoContainer');
        if (wgContainer) {
          wgContainer.style.zIndex = '10000';
          wgContainer.style.display = 'block';
          // Hacemos que los clics traspasen el video para poder hacer clic en los puntos
          wgContainer.style.pointerEvents = 'none';
          wgContainer.style.opacity = '0.7';
          // Lo ubicamos abajo al centro, evitando los puntos de calibración (que están al 90% en y)
          wgContainer.style.position = 'fixed';
          wgContainer.style.top = 'auto';
          wgContainer.style.left = '50%';
          wgContainer.style.bottom = '0px';
          wgContainer.style.transform = 'translate(-50%, 0) scale(0.8)';
          wgContainer.style.transformOrigin = 'bottom center';
        }
      } catch (e) {
        this.logger('error', 'Error al configurar video preview:', e);
      }

      // Silenciar el video de WebGazer (forzar inmediatamente)
      this.muteAllWebgazerVideos();

      this.logger('success', '👁️ WebGazer iniciado — Haz clic en los puntos rojos mirándolos fijamente');
      return true;
    } catch (error) {
      const errorMsg = `❌ Error al iniciar WebGazer: ${error instanceof Error ? error.message : String(error)}`;
      this.logger('error', errorMsg, error);
      this.calibrationStatus = 'error';
      this.calibrationError$.next(errorMsg);
      return false;
    }
  }

  /**
   * Registra un punto de calibración (usuario hace clic mirando un punto).
   * WebGazer aprende de la posición del clic + posición de ojos.
   *
   * @param screenX - Coordenada X del clic en pantalla (píxeles)
   * @param screenY - Coordenada Y del clic en pantalla (píxeles)
   */
  recordCalibrationClick(screenX: number, screenY: number): void {
    if (!this.webgazer) {
      this.logger('error', 'WebGazer no está inicializado');
      return;
    }

    // Como desactivamos el mouse tracking global para que el punto no siga al ratón,
    // TENEMOS que enviarle manualmente a WebGazer las coordenadas de los clics para que aprenda.
    if (typeof this.webgazer.recordScreenPosition === 'function') {
      this.webgazer.recordScreenPosition(screenX, screenY, 'click');
    }

    this.calibrationPointsRecorded++;
    this.logger('info', `📍 Punto de calibración #${this.calibrationPointsRecorded} registrado en (${screenX}, ${screenY})`);
    console.log(`[GAZE] 📍 Punto de calibración #${this.calibrationPointsRecorded}: (${screenX}, ${screenY})`);
  }

  /**
   * Completa la calibración y devuelve la referencia a WebGazer.
   * Se llama cuando el usuario ha completado los puntos de calibración.
   *
   * Pasos:
   * 1. Marcar calibración como completada
   * 2. Intentar resume() en WebGazer por si fue auto-pausado
   * 3. Mover container de WebGazer fuera de pantalla (visible pero offscreen)
   * 4. Ocultar gaze dot
   * 5. Retornar la instancia de WebGazer para que el Facade la use en tracking
   */
  async completeCalibration(): Promise<WebGazerAPI | null> {
    if (this.calibrationStatus !== 'in-progress') {
      this.logger('error', 'Calibración no está en progreso');
      return null;
    }

    try {
      this.calibrationStatus = 'completed';
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

        // Estrategia: dejar WebGazer 100% visible pero renderizado fuera de pantalla
        // Los navegadores modernos detienen el pipeline de video si detectan que no es visible
        // (opacity=0, visibility=hidden, display=none, etc.)
        // Solución: manenerlo visible pero en posición fixed fuera del viewport
        const wgContainer = document.getElementById('webgazerVideoContainer');
        if (wgContainer) {
          // Restaurar visibilidad
          wgContainer.style.opacity = '1';
          wgContainer.style.visibility = 'visible';
          wgContainer.style.display = 'block';

          // Moverlo fuera de la pantalla
          wgContainer.style.position = 'fixed';
          wgContainer.style.top = '-9999px';
          wgContainer.style.left = '-9999px';
          wgContainer.style.pointerEvents = 'none';
        }

        // Ocultar gaze dot
        const gazeDot = document.getElementById('webgazerGazeDot');
        if (gazeDot) {
          gazeDot.style.display = 'none';
        }
      }

      this.logger('success', '✅ Calibración completada');

      // Emitir evento de completitud
      const result: CalibrationResult = {
        success: true,
        pointsRecorded: this.calibrationPointsRecorded,
        webgazer: this.webgazer,
      };

      this.calibrationCompleted$.next(result);
      return this.webgazer;
    } catch (error) {
      const errorMsg = `Error al completar calibración: ${error instanceof Error ? error.message : String(error)}`;
      this.logger('error', errorMsg, error);
      this.calibrationStatus = 'error';
      this.calibrationError$.next(errorMsg);
      return null;
    }
  }

  /**
   * Reinicia el estado de calibración sin afectar WebGazer.
   * Útil para reintentarlo después de error.
   */
  resetCalibration(): void {
    this.calibrationStatus = 'idle';
    this.gazeFrameCount = 0;
    this.lastGazeLogTime = 0;
    this.calibrationPointsRecorded = 0;
    // No tocamos this.webgazer — puede ser reutilizado o limpiado externamente
    this.logger('info', 'ℹ️ Estado de calibración reiniciado');
  }

  /**
   * Limpia recursos del servicio (se llama en stop() del Facade).
   * - Completa y desuscribe los Subjects
   * - Detiene WebGazer
   * - Restaura getUserMedia si fue monkey-patcheada
   */
  destroy(): void {
    try {
      // Detener WebGazer
      if (this.webgazer) {
        try {
          this.webgazer.end();
        } catch (e) {
          // WebGazer puede fallar al detenerse si ya fue destruido
        }
        this.webgazer = null;
      }

      // Restaurar getUserMedia original si fue modificada
      if (this.originalGetUserMedia) {
        navigator.mediaDevices.getUserMedia = this.originalGetUserMedia;
        this.originalGetUserMedia = null;
      }

      // Completar subjects para que se desuscriban los listeners
      this.calibrationCompleted$.complete();
      this.calibrationError$.complete();

      this.calibrationStatus = 'idle';
      this.logger('info', '🛑 GazeCalibrationService limpiado');
    } catch (error) {
      this.logger('error', 'Error al limpiar GazeCalibrationService:', error);
    }
  }

  // ─── Private Methods ───────────────────────────────────────────

  /**
   * Maneja datos de gaze recibidos durante calibración.
   * Se ejecuta FUERA de la zona Angular (ngZone.runOutsideAngular).
   */
  private handleGazeData(data: WebGazerPrediction | null): void {
    // Contar TODOS los callbacks, incluyendo data=null
    this.gazeFrameCount++;

    if (!data) {
      // WebGazer llama con null cuando no detecta rostro
      if (this.gazeFrameCount % 30 === 0) {
        console.log(`[GAZE-CALIB] Frame #${this.gazeFrameCount} — data=null (no face detected)`);
      }
      return;
    }

    // Log de primeros datos
    if (this.gazeFrameCount <= 3) {
      this.logger('success', `👁️ Dato de gaze #${this.gazeFrameCount} recibido de WebGazer`);
      console.log(`[GAZE-CALIB] ✅ Dato de gaze #${this.gazeFrameCount}:`, data);
    }

    // Log periódico a consola cada 60 frames (~2s a 30fps)
    if (this.gazeFrameCount % 60 === 0) {
      console.log(`[GAZE-CALIB] Frame #${this.gazeFrameCount} → x:${data.x?.toFixed(0)}, y:${data.y?.toFixed(0)}`);
    }

    // Log via logger cada 2 segundos
    const now = Date.now();
    if (now - this.lastGazeLogTime >= 2000) {
      this.lastGazeLogTime = now;
      this.logger('info', `🔬 Calibrando — Gaze raw: (${data.x?.toFixed(0)}, ${data.y?.toFixed(0)}) — frames: ${this.gazeFrameCount}`);
    }
  }

  /**
   * Silencia TODOS los videos de WebGazer en el DOM.
   * Workaround para issue de timing en WebGazer.
   */
  private muteAllWebgazerVideos(): void {
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
        // Verificar si es un video de WebGazer
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
}
