import { Component, Input, OnInit, OnDestroy, inject, viewChild, ElementRef, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MediaService } from '../../services/media.service';
import { EvidenceService } from '../../services/evidence.service';
import { SusieConfig, EvidencePayload } from '../../models/contracts';
import { interval, Subscription } from 'rxjs';

@Component({
  selector: 'susie-wrapper',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="susie-container">
      <!-- Slot para la aplicación anfitriona (El Examen) -->
      <div class="susie-content">
        <ng-content></ng-content>
      </div>

      <!-- Overlay de Alertas/Errores -->
      @if (mediaService.error()) {
        <div class="susie-alert error">
          <p>{{ mediaService.error() }}</p>
          <button (click)="retryMedia()">Reintentar permiso de cámara</button>
        </div>
      }

      <!-- Componente PIP (Picture-in-Picture) simulado -->
      <!-- En una implementación real, esto sería el componente <susie-camera-pip> -->
      <div class="susie-pip" [class.hidden]="!mediaService.isActive()">
        <video #userVideo autoplay playsinline muted></video>
        <div class="recording-indicator">
          <span class="dot"></span> REC
        </div>
      </div>
    </div>
  `,
  styles: [`
    .susie-container {
      position: relative;
      width: 100%;
      height: 100vh;
      overflow: hidden;
      background: #f4f4f4;
    }
    
    .susie-content {
      width: 100%;
      height: 100%;
      z-index: 1;
    }

    .susie-pip {
      position: absolute;
      bottom: 20px;
      right: 20px;
      width: 240px;
      height: 135px; /* 16:9 Aspect Ratio */
      background: #000;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 4px 15px rgba(0,0,0,0.3);
      z-index: 1000;
      border: 2px solid #fff;
    }

    video {
      width: 100%;
      height: 100%;
      object-fit: cover;
      transform: scaleX(-1); /* Efecto espejo */
    }

    .recording-indicator {
      position: absolute;
      top: 8px;
      left: 8px;
      background: rgba(0, 0, 0, 0.6);
      color: white;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 10px;
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .dot {
      width: 6px;
      height: 6px;
      background-color: red;
      border-radius: 50%;
      animation: blink 1s infinite;
    }

    @keyframes blink {
      0% { opacity: 1; }
      50% { opacity: 0.3; }
      100% { opacity: 1; }
    }

    .susie-alert.error {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: #fff0f0;
      border: 1px solid #ffcccc;
      color: #cc0000;
      padding: 20px;
      border-radius: 8px;
      text-align: center;
      z-index: 2000;
    }
  `]
})
export class SusieWrapperComponent implements OnInit, OnDestroy {
  @Input({ required: true }) config!: SusieConfig;

  // Inyección de dependencias
  public mediaService = inject(MediaService);
  private evidenceService = inject(EvidenceService);

  // Referencia al elemento de video en el template
  videoElement = viewChild<ElementRef<HTMLVideoElement>>('userVideo');

  private snapshotSubscription?: Subscription;

  constructor() {
    // Efecto síncrono para asignar el stream al elemento de video cuando esté disponible
    effect(() => {
      const stream = this.mediaService.stream();
      const videoEl = this.videoElement()?.nativeElement;
      if (stream && videoEl) {
        videoEl.srcObject = stream;
      }
    });
  }

  async ngOnInit() {
    if (!this.config) {
      console.error('SusieWrapper: Configuración requerida no provista.');
      return;
    }

    // Inicializar servicios
    this.evidenceService.setConfig(this.config);

    // Iniciar cámara si las políticas lo requieren
    if (this.config.securityPolicies.requireCamera) {
      await this.mediaService.startStream(true, false);
    }

    // Iniciar ciclo de monitoreo (snapshots cada 30 segundos, configurable)
    this.startMonitoringCycle();
  }

  ngOnDestroy() {
    this.mediaService.stopStream();
    this.snapshotSubscription?.unsubscribe();
  }

  retryMedia() {
    // Por defecto audio false ya que no está en el contrato estricto, pero podríamos habilitarlo si se requiere
    this.mediaService.startStream(true, false);
  }

  private startMonitoringCycle() {
    // Ejemplo: Tomar snapshot cada 30 segundos
    this.snapshotSubscription = interval(30000).subscribe(async () => {
      const videoEl = this.videoElement()?.nativeElement;
      if (videoEl && this.mediaService.isActive()) {
        const blob = await this.mediaService.takeSnapshot(videoEl);

        if (blob) {
          this.sendSnapshot(blob);
        }
      }
    });
  }

  private sendSnapshot(imageBlob: Blob) {
    // Extendemos localmente para incluir el archivo que no está en el contrato estricto JSON
    // pero es necesario para el servicio de FormData
    const payload: EvidencePayload = {
      metadata: {
        meta: {
          correlation_id: this.config.sessionContext.examSessionId,
          timestamp: new Date().toISOString(),
          source: 'frontend_client_v1'
        },
        payload: {
          type: 'SNAPSHOT',
          browser_focus: document.hasFocus()
        }
      },
      file: imageBlob
    };

    this.evidenceService.sendEvidence(payload).subscribe({
      next: () => console.log('Snapshot enviado correctamente', payload.metadata.meta.timestamp),
      error: (err: unknown) => console.error('Error enviando snapshot', err)
    });
  }
}
