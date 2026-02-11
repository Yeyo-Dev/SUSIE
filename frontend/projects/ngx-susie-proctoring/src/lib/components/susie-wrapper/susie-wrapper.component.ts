import { Component, Input, OnInit, OnDestroy, inject, viewChild, ElementRef, effect, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MediaService } from '../../services/media.service';
import { EvidenceService } from '../../services/evidence.service';
import { SecurityService } from '../../services/security.service';
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
          <button (click)="retryMedia()">Reintentar permiso de cámara/micrófono</button>
        </div>
      }

      <!-- Panel de Debug (solo para pruebas) -->
      @if (config.debugMode) {
        <div class="debug-panel">
          <div class="debug-header">
            <strong>🔍 Debug Panel</strong>
            <button (click)="clearDebugLogs()" class="clear-btn">Limpiar</button>
          </div>
          <div class="debug-content">
            @for (log of debugLogs(); track log.timestamp) {
              <div class="debug-log" [class]="log.type">
                <span class="timestamp">{{ log.timestamp | date:'HH:mm:ss' }}</span>
                <span class="icon">{{ log.icon }}</span>
                <span class="message">{{ log.message }}</span>
                @if (log.details) {
                  <div class="details">{{ log.details }}</div>
                }
              </div>
            }
          </div>
        </div>
      }

      <!-- Componente PIP (Picture-in-Picture) simulado -->
      <div class="susie-pip" [class.hidden]="!mediaService.isActive()">
        <video #userVideo autoplay playsinline muted></video>
        <div class="recording-indicator">
          <span class="dot"></span> 
          REC @if (mediaService.audioRecordingActive()) { 🎤 }
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

    .debug-panel {
      position: fixed;
      top: 20px;
      left: 20px;
      width: 400px;
      max-height: 300px;
      background: rgba(0, 0, 0, 0.9);
      border: 2px solid #00ff00;
      border-radius: 8px;
      color: #00ff00;
      font-family: 'Courier New', monospace;
      font-size: 11px;
      z-index: 9999;
      overflow: hidden;
      box-shadow: 0 4px 20px rgba(0, 255, 0, 0.3);
    }

    .debug-header {
      background: #1a1a1a;
      padding: 8px 12px;
      border-bottom: 1px solid #00ff00;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .clear-btn {
      background: #00ff00;
      color: #000;
      border: none;
      padding: 2px 8px;
      border-radius: 3px;
      cursor: pointer;
      font-size: 10px;
      font-weight: bold;
    }

    .clear-btn:hover {
      background: #00cc00;
    }

    .debug-content {
      max-height: 250px;
      overflow-y: auto;
      padding: 8px;
    }

    .debug-log {
      padding: 6px;
      margin-bottom: 4px;
      border-left: 3px solid #00ff00;
      background: rgba(0, 255, 0, 0.05);
    }

    .debug-log.error {
      border-left-color: #ff0000;
      color: #ff6666;
    }

    .debug-log.success {
      border-left-color: #00ff00;
      color: #00ff00;
    }

    .timestamp {
      color: #888;
      margin-right: 8px;
    }

    .icon {
      margin-right: 6px;
    }

    .message {
      font-weight: bold;
    }

    .details {
      margin-top: 4px;
      padding-left: 60px;
      color: #aaa;
      font-size: 10px;
      white-space: pre-wrap;
      word-break: break-all;
    }

    .susie-pip {
      position: absolute;
      bottom: 20px;
      right: 20px;
      width: 240px;
      height: 135px;
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
      transform: scaleX(-1);
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
  private securityService = inject(SecurityService);

  // Referencia al elemento de video en el template
  videoElement = viewChild<ElementRef<HTMLVideoElement>>('userVideo');

  private snapshotSubscription?: Subscription;

  // Contadores de eventos de comportamiento para AI
  private keyboardEventCount = 0;
  private tabSwitchCount = 0;

  // Debug logs (solo para pruebas)
  private debugLogsSignal = signal<Array<{
    timestamp: Date;
    type: 'success' | 'error';
    icon: string;
    message: string;
    details?: string;
  }>>([]);
  readonly debugLogs = this.debugLogsSignal.asReadonly();

  constructor() {
    // Efecto síncrono para asignar el stream al elemento de video cuando esté disponible
    // IMPORTANTE: Solo asignamos las pistas de VIDEO para evitar feedback de audio
    effect(() => {
      const stream = this.mediaService.stream();
      const videoEl = this.videoElement()?.nativeElement;
      if (stream && videoEl) {
        // Crear un nuevo stream solo con las pistas de video
        const videoTracks = stream.getVideoTracks();
        if (videoTracks.length > 0) {
          const videoOnlyStream = new MediaStream(videoTracks);
          videoEl.srcObject = videoOnlyStream;
        }
      }
    });
  }

  private addDebugLog(type: 'success' | 'error', icon: string, message: string, details?: string) {
    const logs = this.debugLogsSignal();
    const newLog = {
      timestamp: new Date(),
      type,
      icon,
      message,
      details
    };

    // Mantener solo los últimos 5 logs
    const updatedLogs = [newLog, ...logs].slice(0, 5);
    this.debugLogsSignal.set(updatedLogs);
  }

  clearDebugLogs() {
    this.debugLogsSignal.set([]);
  }

  async ngOnInit() {
    if (!this.config) {
      console.error('SusieWrapper: Configuración requerida no provista.');
      return;
    }

    // Inicializar servicios
    this.evidenceService.setConfig(this.config);
    this.securityService.initialize(this.config.securityPolicies);

    // Determinar si necesitamos audio
    const needsAudio = this.config.securityPolicies.requireMicrophone ||
      this.config.audioConfig?.enabled;

    // Iniciar cámara/micrófono si las políticas lo requieren
    if (this.config.securityPolicies.requireCamera || needsAudio) {
      await this.mediaService.startStream(
        this.config.securityPolicies.requireCamera,
        needsAudio
      );
    }

    // Iniciar grabación de audio si está habilitado
    if (needsAudio) {
      await this.startAudioRecording();
    }

    // Configurar tracking de eventos de comportamiento para AI
    this.setupBehavioralTracking();

    // Iniciar snapshots periódicos si la cámara está habilitada
    if (this.config.securityPolicies.requireCamera) {
      this.startMonitoringCycle();
    }
  }

  private setupBehavioralTracking() {
    // Trackear eventos de teclado
    document.addEventListener('keydown', () => {
      this.keyboardEventCount++;
    });

    // Trackear cambios de pestaña (pérdida de foco)
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.tabSwitchCount++;
        console.log(`⚠️ Tab switch detectado (total: ${this.tabSwitchCount})`);
      }
    });
  }

  ngOnDestroy() {
    this.mediaService.stopAudioRecording();
    this.mediaService.stopStream();
    this.snapshotSubscription?.unsubscribe();
  }

  retryMedia() {
    const needsAudio = this.config.securityPolicies.requireMicrophone ||
      this.config.audioConfig?.enabled;

    this.mediaService.startStream(
      this.config.securityPolicies.requireCamera,
      needsAudio
    );
  }

  private async startAudioRecording() {
    try {
      // Obtener intervalo de chunks de la configuración o usar default (10s)
      const chunkIntervalSeconds = this.config.audioConfig?.chunkIntervalSeconds || 10;
      const chunkIntervalMs = chunkIntervalSeconds * 1000;

      await this.mediaService.startAudioRecording(
        (audioBlob) => this.sendAudioChunk(audioBlob),
        chunkIntervalMs
      );

      console.log(`✅ Grabación de audio iniciada (chunks cada ${chunkIntervalSeconds}s)`);
    } catch (error) {
      console.error('❌ Error al iniciar grabación de audio:', error);
    }
  }

  private sendAudioChunk(audioBlob: Blob) {
    const payload: EvidencePayload = {
      metadata: {
        meta: {
          correlation_id: this.config.sessionContext.examSessionId,
          exam_id: this.config.sessionContext.examId,
          student_id: 'STUDENT_ID_PLACEHOLDER', // TODO: Obtener del authToken JWT
          timestamp: new Date().toISOString(),
          source: 'frontend_client_v1'
        },
        payload: {
          type: 'AUDIO_CHUNK',
          browser_focus: document.hasFocus(),
          keyboard_events: this.keyboardEventCount,
          tab_switches: this.tabSwitchCount
        }
      },
      file: audioBlob
    };

    this.evidenceService.sendEvidence(payload).subscribe({
      next: (response) => {
        console.log('🎤 Audio chunk enviado correctamente');
        console.log('📦 Respuesta del backend:', response);

        this.addDebugLog(
          'success',
          '🎤',
          'Audio chunk enviado',
          `URL: ${response.data?.file_url}\nTamaño: ${response.data?.file_size} bytes\nStatus: ${response.status}`
        );
      },
      error: (err: unknown) => {
        console.error('❌ Error enviando audio chunk:', err);

        this.addDebugLog(
          'error',
          '❌',
          'Error enviando audio',
          err instanceof Error ? err.message : 'Error desconocido'
        );
      }
    });
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
          exam_id: this.config.sessionContext.examId,
          student_id: 'STUDENT_ID_PLACEHOLDER', // TODO: Obtener del authToken JWT
          timestamp: new Date().toISOString(),
          source: 'frontend_client_v1'
        },
        payload: {
          type: 'SNAPSHOT',
          browser_focus: document.hasFocus(),
          keyboard_events: this.keyboardEventCount,
          tab_switches: this.tabSwitchCount
        }
      },
      file: imageBlob
    };

    this.evidenceService.sendEvidence(payload).subscribe({
      next: (response) => {
        console.log('📸 Snapshot enviado correctamente');
        console.log('📦 Respuesta del backend:', response);
        console.log('🔗 URL simulada:', response.data?.file_url);
        console.log('📊 Tamaño:', response.data?.file_size, 'bytes');
      },
      error: (err: unknown) => {
        console.error('❌ Error enviando snapshot:', err);
      }
    });
  }
}
