import { ElementRef } from '@angular/core';
import { EvidenceService } from '../services/evidence.service';
import { GazeTrackingService, GazePoint } from '../services/gaze-tracking.service';
import { MediaService } from '../services/media.service';
import { IntervalHandle, LoggerFn, MediaStreamSource } from '../models/contracts';

/**
 * Helper class para manejar los loops de monitoreo (snapshots, gaze tracking).
 * No es un service - es una clase de utilidad que el componente usa directamente.
 * 
 * Esto mantiene la complejidad de los loops fuera del componente principal.
 */
export class ProctoringMonitorHelper {
  private snapshotInterval: IntervalHandle | null = null;
  private gazeInterval: IntervalHandle | null = null;
  
  // Reference to video element for snapshot capture
  private snapshotVideoRef: ElementRef<HTMLVideoElement> | null = null;

  constructor(
    private readonly evidenceService: EvidenceService,
    private readonly gazeService: GazeTrackingService,
    private readonly mediaService: MediaService,
    private readonly onSnapshotCaptured: () => void,
    private readonly log: (type: 'info' | 'error' | 'success', msg: string) => void
  ) {}

  /**
   * Setea la referencia al video element para captura de snapshots.
   */
  setVideoRef(videoRef: ElementRef<HTMLVideoElement>): void {
    this.snapshotVideoRef = videoRef;
  }

  /**
    * Inicia el loop de captura periódica de snapshots.
    */
  startSnapshotLoop(intervalSeconds: number, mediaStream: MediaStreamSource): void {
    this.log('info', `📸 Iniciando snapshots cada ${intervalSeconds}s`);
    this.stopSnapshotLoop();

    // Attach stream to hidden video after a tick
    setTimeout(() => {
      if (this.snapshotVideoRef?.nativeElement && mediaStream) {
        const videoEl = this.snapshotVideoRef.nativeElement;
        videoEl.srcObject = mediaStream;
        videoEl.muted = true;
        videoEl.volume = 0;
      }
    });

    this.snapshotInterval = setInterval(() => {
      this.captureSnapshot();
    }, intervalSeconds * 1000);
  }

  /**
   * Detiene el loop de snapshots.
   */
  stopSnapshotLoop(): void {
    if (this.snapshotInterval) {
      clearInterval(this.snapshotInterval);
      this.snapshotInterval = null;
    }
  }

  /**
   * Captura un snapshot del video y lo envía al backend.
   */
  private captureSnapshot(): void {
    if (!this.snapshotVideoRef?.nativeElement) return;
    
    const video = this.snapshotVideoRef.nativeElement;
    if (video.readyState < 2) return; // HAVE_CURRENT_DATA

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(blob => {
      if (!blob) return;

      const gazeHistory = this.gazeService.isCalibrated()
        ? this.gazeService.flushGazeBuffer()
        : undefined;

      this.evidenceService.sendEvent({
        type: 'SNAPSHOT',
        browser_focus: document.hasFocus(),
        file: blob,
        ...(gazeHistory?.length ? { gaze_history: gazeHistory } : {})
      } as any);
      
      this.onSnapshotCaptured();
    }, 'image/jpeg', 0.6);
  }

  /**
   * Inicia el loop de envío periódico de gaze tracking.
   */
  startGazeLoop(): void {
    this.log('info', '👁️ Iniciando gaze tracking (cada 5s)');
    this.stopGazeLoop();

    this.gazeInterval = setInterval(() => {
      const recentPoints = this.gazeService.flushGazeBuffer();
      if (recentPoints && recentPoints.length > 0) {
        const mappedPoints = recentPoints.map((p: GazePoint) => ({ x: p.x, y: p.y }));
        this.evidenceService.sendGazeData(mappedPoints);
      }
    }, 5000);
  }

  /**
   * Detiene el loop de gaze.
   */
  stopGazeLoop(): void {
    if (this.gazeInterval) {
      clearInterval(this.gazeInterval);
      this.gazeInterval = null;
    }
  }

  /**
   * Cleanup de todos los intervals.
   */
  destroy(): void {
    this.stopSnapshotLoop();
    this.stopGazeLoop();
  }
}